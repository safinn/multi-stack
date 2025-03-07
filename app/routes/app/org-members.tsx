import type { Selectable } from 'kysely'
import type { Route } from './+types/org-members'
import type { Membership, Role, User } from '~/data/db.d'
import process from 'node:process'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { useEffect, useRef } from 'react'
import { data, Form, href, redirect, useFetcher, useNavigation } from 'react-router'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { StatusButton } from '~/components/ui/status-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { db } from '~/data/db'
import { repositoryFactory } from '~/data/factory'
import { IdentityRespository } from '~/data/repositories/identity'
import { RoleRepository } from '~/data/repositories/role'
import { emailer } from '~/email/emailer'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { cn, getDomainUrl, useDoubleCheck, useIsPending } from '~/utils/misc'
import { requireUserWithOrganizationPermission } from '~/utils/permissions.server'
import { createToastHeaders } from '~/utils/toast.server'

export const handle = {
  breadcrumb: 'Members',
}

const InviteTeamMemberSchema = z.object({
  intent: z.literal('invite'),
  email: z.string({ required_error: 'Email is required' }).email(),
})

const RemoveTeamMemberSchema = z.object({
  intent: z.literal('remove'),
  memberId: z.string(),
})

const UpdateTeamMemberRoleSchema = z.object({
  intent: z.literal('update-role'),
  memberId: z.string(),
  role: z.string(),
})

const ActionSchema = z.discriminatedUnion('intent', [
  InviteTeamMemberSchema,
  RemoveTeamMemberSchema,
  UpdateTeamMemberRoleSchema,
])

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, organization: organiastion } = await requireUserInOrganization(request, params.organizationId)
  await requireUserWithOrganizationPermission(request, organiastion.shortId, 'read:user:any')

  const identityRespository = new IdentityRespository(db)
  const [members, membership, roles] = await Promise.all([
    identityRespository.findMembershipsByOrganizationWithUsers(organiastion.id),
    identityRespository.findMembershipByUserAndOrganizationShortId(user.id, organiastion.shortId),
    new RoleRepository(db).findAll(),
  ])

  return { user, organiastion, members, roles, membership }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, organization: organiastion } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()
  const submission = parseWithZod(formData, {
    schema: ActionSchema,
  })

  if (submission.status !== 'success') {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  switch (submission.value.intent) {
    case 'invite': {
      const email = submission.value.email
      await requireUserWithOrganizationPermission(request, organiastion.shortId, 'create:user:any')
      const membershipsWithUsers = await repositoryFactory.getIdentityRepository().findMembershipsByOrganizationWithUsers(organiastion.id)
      const existingMember = membershipsWithUsers.find(member =>
        member.user?.email === email
        || member.inviteEmail === email)
      if (existingMember) {
        return data(submission.reply({ formErrors: ['Member already exists'] }), { status: 400 })
      }

      const invitationId = uuidv7()
      const membership = await repositoryFactory.getMembershipRepository().create({
        id: uuidv7(),
        organizationId: organiastion.id,
        invitationId,
        invitedById: user.id,
        inviteEmail: email,
        roles: ['editor'],
      })

      if (!membership) {
        return data(submission.reply({ formErrors: ['Failed to invite member'] }), {
          status: 500,
        })
      }

      await emailer.send(email, 'team_invite', {
        team: organiastion.name,
        productName: process.env.PRODUCT_NAME,
        invite: `${getDomainUrl(request)}/signup?invitationId=${invitationId}`,
      })

      return submission.reply({ resetForm: true })
    }
    case 'remove': {
      await requireUserWithOrganizationPermission(request, organiastion.shortId, 'delete:user:any')
      const removeMemberId = submission.value.memberId
      const members = await repositoryFactory.getIdentityRepository().findMembershipsByOrganizationWithUsers(organiastion.id)

      const member = members.find(member => member.id === removeMemberId)
      const isPersonalOrganization = organiastion.personalOrganizationUserId === removeMemberId
      const isLastMember = members.length === 1
      const isAdmin = member?.roles.includes('admin')
      const adminCount = members.filter(member => member.userId && member.roles.includes('admin')).length
      const isLastAdmin = isAdmin && adminCount === 1

      // Cannot remove last admin, last member or user from personal organization
      if (!member || isLastAdmin || isPersonalOrganization || isLastMember) {
        return data(submission.reply({ formErrors: ['Cannot remove member'] }), { status: 400 })
      }

      await repositoryFactory.getMembershipRepository().delete(removeMemberId)

      if (member.userId === user.id) {
        return redirect(href('/app/:organizationId?'))
      }

      return null
    }
    case 'update-role': {
      await requireUserWithOrganizationPermission(request, organiastion.shortId, 'update:user:any')
      await repositoryFactory.getMembershipRepository().patch(submission.value.memberId, {
        roles: [submission.value.role],
      })

      return data(null, {
        headers: await createToastHeaders({
          title: 'Role updated',
          description: 'The role has been updated',
          type: 'success',
        }),
      })
    }
  }
}

export default function Team({ loaderData, actionData }: Route.ComponentProps) {
  const adminCount = loaderData.members.filter(member => member.userId && member.roles.includes('admin')).length

  const members = loaderData.members.map((member) => {
    const memberUser = member.user
    const isLastAdmin = member.userId && member.roles.includes('admin') && adminCount === 1
    const isPersonalOrganization = loaderData.organiastion.personalOrganizationUserId === memberUser?.id
    const isLastMember = loaderData.members.length === 1
    const canRemove = !isLastAdmin && !isPersonalOrganization && !isLastMember

    const availableRoles = loaderData.roles.filter((role) => {
      if (isLastAdmin && role.name !== 'admin')
        return false

      return true
    })

    return (
      <Member
        key={member.id}
        member={member}
        user={memberUser}
        canRemove={canRemove}
        roles={availableRoles}
        canUpdateRole={loaderData.membership?.roles.includes('admin') || false}
      />
    )
  })

  const navigation = useNavigation()
  const isPending = useIsPending()
  const pendingIntent = isPending ? navigation.formData?.get('intent') : null

  const [form, fields] = useForm({
    constraint: getZodConstraint(InviteTeamMemberSchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: InviteTeamMemberSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  const lastSubmissionIntent = fields.intent.value
  const inviteInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (lastSubmissionIntent === 'invite')
      inviteInput.current?.focus()
  }, [lastSubmissionIntent])

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end items-center gap-2">
        <Form method="POST" {...getFormProps(form)} className="flex gap-2">
          <input type="hidden" name="intent" value="invite" />
          <Input ref={inviteInput} {...getInputProps(fields.email, { type: 'email' })} />
          <StatusButton
            type="submit"
            status={
              pendingIntent === 'invite'
                ? 'pending'
                : lastSubmissionIntent === 'invite'
                  ? (form.status ?? 'idle')
                  : 'idle'
            }
            disabled={pendingIntent === 'invite'}
          >
            Invite member
          </StatusButton>
        </Form>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-[132px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members}
        </TableBody>
      </Table>
    </div>
  )
}

function Member({
  member,
  user,
  canRemove,
  roles,
  canUpdateRole,
}:
{
  member: Selectable<Membership>
  user?: Selectable<User>
  canRemove: boolean
  roles: Selectable<Role>[]
  canUpdateRole: boolean
}) {
  const removeFetcher = useFetcher()
  const roleFetcher = useFetcher()
  const dc = useDoubleCheck()

  const roleForm = useRef<HTMLFormElement>(null)

  return (
    <TableRow>
      <TableCell className={cn({ 'text-muted-foreground': !user?.username })}>
        {user?.username ? user?.username : 'Pending...'}
      </TableCell>
      <TableCell>{user?.email ?? member.inviteEmail}</TableCell>
      <TableCell className="capitalize">
        <roleFetcher.Form method="POST" ref={roleForm}>
          <input type="hidden" name="intent" value="update-role" />
          <input type="hidden" name="memberId" value={member.id} />
          <Select
            defaultValue={member.roles[0]}
            onValueChange={() => roleFetcher.submit(roleForm.current, {
              method: 'POST',
            })}
            name="role"
            disabled={roleFetcher.state !== 'idle' || !canUpdateRole}
          >
            <SelectTrigger className="w-[180px] h-8 rounded-md px-3 has-[>svg]:px-2.5 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map(role => (
                <SelectItem key={role.name} value={role.name} className="capitalize">
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </roleFetcher.Form>
      </TableCell>
      <TableCell>
        {canRemove && (
          <removeFetcher.Form method="POST">
            <input type="hidden" name="memberId" value={member.id} />
            <StatusButton
              {...dc.getButtonProps({
                type: 'submit',
                name: 'intent',
                value: 'remove',
              })}
              variant="destructive"
              size="sm"
              status={
                removeFetcher.state !== 'idle'
                  ? 'pending'
                  : (removeFetcher.data?.status ?? 'idle')
              }
            >
              {dc.doubleCheck ? 'Are you sure?' : 'Remove'}
            </StatusButton>
          </removeFetcher.Form>
        )}
      </TableCell>
    </TableRow>
  )
}
