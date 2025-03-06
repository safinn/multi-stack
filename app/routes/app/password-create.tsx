import type { Route } from './+types/password-create'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, Link, redirect } from 'react-router'
import { ErrorList, Field } from '~/components/forms'
import { Button } from '~/components/ui/button'
import { StatusButton } from '~/components/ui/status-button'
import { repositoryFactory } from '~/data/factory'
import { getPasswordHash, requireUserInOrganization } from '~/utils/auth/auth.server'
import { useIsPending } from '~/utils/misc'
import { PasswordAndConfirmPasswordSchema } from '~/utils/user-validation'

const CreatePasswordForm = PasswordAndConfirmPasswordSchema

async function requireNoPassword(userId: string, organizationId?: string) {
  const password = await repositoryFactory.getPasswordRepository().findByUserId(userId)
  if (password) {
    const redirectTo = ['/app', organizationId, 'settings', 'password']
      .filter(Boolean)
      .join('/')
    throw redirect(redirectTo)
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  await requireNoPassword(user.id)
  return { user }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  await requireNoPassword(user.id)
  const formData = await request.formData()
  const submission = await parseWithZod(formData, {
    async: true,
    schema: CreatePasswordForm,
  })
  if (submission.status !== 'success') {
    return data(
      submission.reply({
        hideFields: ['password', 'confirmPassword'],
      }),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { password } = submission.value

  await repositoryFactory.getPasswordRepository().create({
    userId: user.id,
    hash: await getPasswordHash(password),
  })

  const redirectTo = ['/app', params.organizationId, 'settings']
    .filter(Boolean)
    .join('/')
  return redirect(redirectTo, { status: 302 })
}

export const handle = {
  breadcrumb: 'Create Password',
}

export default function CreatePassword({ actionData }: Route.ComponentProps) {
  const isPending = useIsPending()

  const [form, fields] = useForm({
    constraint: getZodConstraint(CreatePasswordForm),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: CreatePasswordForm })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <Form method="POST" {...getFormProps(form)}>
        <Field
          className="max-w-72"
          labelProps={{ children: 'New Password' }}
          inputProps={{
            ...getInputProps(fields.password, { type: 'password' }),
            autoComplete: 'new-password',
          }}
          errors={fields.password.errors}
        />
        <Field
          className="max-w-72"
          labelProps={{ children: 'Confirm New Password' }}
          inputProps={{
            ...getInputProps(fields.confirmPassword, {
              type: 'password',
            }),
            autoComplete: 'new-password',
          }}
          errors={fields.confirmPassword.errors}
        />
        <ErrorList id={form.errorId} errors={form.errors} />
        <div className="flex gap-4 mt-6">
          <Button variant="secondary" asChild>
            <Link to="..">Cancel</Link>
          </Button>
          <StatusButton
            status={isPending ? 'pending' : (form.status ?? 'idle')}
            type="submit"
            disabled={isPending}
          >
            Create Password
          </StatusButton>
        </div>
      </Form>
    </>
  )
}
