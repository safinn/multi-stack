import type { Route } from './+types/org'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, href, redirect } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { useDoubleCheck, useIsPending } from '~/utils/misc'
import { requireUserWithOrganizationPermission } from '~/utils/permissions.server'

export const handle = {
  breadcrumb: 'Organization General',
}

const UpdateOrgSchema = z.object({
  intent: z.literal('update'),
  name: z.string({ required_error: 'Organization name is required' }).min(3).max(100),
})

const DeleteOrgSchema = z.object({
  intent: z.literal('delete'),
})

const ActionSchema = z.discriminatedUnion('intent', [UpdateOrgSchema, DeleteOrgSchema])

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, organization } = await requireUserInOrganization(request, params.organizationId)
  return { user, organization }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { organization: organiastion } = await requireUserInOrganization(request, params.organizationId)
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
    case 'update': {
      await requireUserWithOrganizationPermission(request, organiastion.shortId, 'update:organization:own')
      await repositoryFactory.getOrganizationRepository().patch(organiastion.id, {
        name: submission.value.name,
      })
      return submission.reply()
    }
    case 'delete': {
      await requireUserWithOrganizationPermission(request, organiastion.shortId, 'delete:organization:own')
      if (organiastion.personalOrganizationUserId) {
        throw new Response('Cannot delete personal organization', { status: 400 })
      }
      await repositoryFactory.getOrganizationRepository().delete(organiastion.id)
      return redirect(href('/app/:organizationId?'))
    }
  }
}

export default function Org({ loaderData, actionData }: Route.ComponentProps) {
  const isPending = useIsPending({ formMethod: 'POST' })
  const isDeletePending = useIsPending({ formMethod: 'DELETE' })
  const lastIntent = actionData?.initialValue?.intent

  const [form, fields] = useForm({
    id: `org-${loaderData.organization.id}`,
    constraint: getZodConstraint(UpdateOrgSchema),
    lastResult: actionData,
    defaultValue: {
      name: loaderData.organization.name,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: UpdateOrgSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  const dc = useDoubleCheck()

  return (
    <div className="space-y-4">
      <Form method="POST" {...getFormProps(form)}>
        <Field
          className="max-w-72"
          labelProps={{ htmlFor: fields.name.id, children: 'Organization Name' }}
          inputProps={{ ...getInputProps(fields.name, { type: 'text' }) }}
          errors={fields.name.errors}
        />
        <ErrorList id={form.errorId} errors={form.errors} />
        <StatusButton
          name="intent"
          value="update"
          status={isPending ? 'pending' : ((lastIntent === 'update' && form.status) || 'idle')}
          type="submit"
          disabled={isPending}
        >
          Update Organization
        </StatusButton>
      </Form>
      {!loaderData.organization.personalOrganizationUserId
        && (
          <Form method="DELETE">
            <StatusButton
              {...dc.getButtonProps({
                type: 'submit',
                name: 'intent',
                value: 'delete',
              })}
              variant="destructive"
              status={isDeletePending ? 'pending' : ((lastIntent === 'delete' && form.status) || 'idle')}
              disabled={isDeletePending}
            >
              {dc.doubleCheck
                ? `Are you sure?`
                : `Delete Organization`}
            </StatusButton>
          </Form>
        )}
    </div>
  )
}
