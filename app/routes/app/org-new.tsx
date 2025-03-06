import type { Route } from './+types/org-new'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, href, redirect } from 'react-router'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { requireUserInOrganization } from '~/utils/auth/auth.server'
import { shortId, useIsPending } from '~/utils/misc'

export const handle = {
  breadcrumb: 'New Organization',
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  return { user }
}

const NewOrgSchema = z.object({
  name: z.string({ required_error: 'Organization name is required' }).min(3).max(100),
})

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  const formData = await request.formData()
  const submission = await parseWithZod(formData, {
    schema: NewOrgSchema,
  })

  if (submission.status !== 'success') {
    return data(
      submission.reply(),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const org = await repositoryFactory.getOrganizationRepository().create({
    id: uuidv7(),
    name: submission.value.name,
    shortId: shortId(6),
  })

  if (!org) {
    throw new Error('Failed to create organization')
  }

  const membership = await repositoryFactory.getMembershipRepository().create({
    id: uuidv7(),
    organizationId: org.id,
    userId: user.id,
    roles: ['admin'],
  })

  if (!membership) {
    throw new Error('Failed to create membership')
  }

  return redirect(href('/app/:organizationId?', { organizationId: org.shortId }))
}

export default function New({ actionData }: Route.ComponentProps) {
  const isPending = useIsPending()

  const [form, fields] = useForm({
    constraint: getZodConstraint(NewOrgSchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: NewOrgSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <Form method="POST" {...getFormProps(form)}>
      <Field
        className="max-w-72"
        labelProps={{ children: 'Organization Name' }}
        inputProps={{
          ...getInputProps(fields.name, { type: 'text' }),
          autoFocus: true,
        }}
        errors={fields.name.errors}
      />
      <ErrorList id={form.errorId} errors={form.errors} />
      <StatusButton
        status={isPending ? 'pending' : (form.status ?? 'idle')}
        type="submit"
        disabled={isPending}
      >
        Create Organization
      </StatusButton>
    </Form>
  )
}
