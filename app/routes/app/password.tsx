import type { Route } from './+types/password'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data, Form, Link, redirect } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { Button } from '~/components/ui/button'
import { StatusButton } from '~/components/ui/status-button'
import { db } from '~/data/db'
import { PasswordRepository } from '~/data/repositories/password'
import { getPasswordHash, requireUserInOrganization, verifyUserPassword } from '~/utils/auth/auth.server'
import { useIsPending } from '~/utils/misc'
import { redirectWithToast } from '~/utils/toast.server'
import { PasswordSchema } from '~/utils/user-validation'

async function requirePassword(userId: string, organizationId?: string) {
  const password = await new PasswordRepository(db).findByUserId(userId)
  if (!password) {
    const redirectTo = ['/app', organizationId, 'settings', 'password', 'create']
      .filter(Boolean)
      .join('/')
    throw redirect(redirectTo)
  }
}

const ChangePasswordForm = z
  .object({
    currentPassword: PasswordSchema,
    newPassword: PasswordSchema,
    confirmNewPassword: PasswordSchema,
  })
  .refine(({ confirmNewPassword, newPassword }) => {
    return confirmNewPassword === newPassword
  }, {
    message: 'The passwords must match',
    path: ['confirmNewPassword'],
  })

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  await requirePassword(user.id)
  return { user }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireUserInOrganization(request, params.organizationId)
  await requirePassword(user.id)
  const formData = await request.formData()
  const submission = await parseWithZod(formData, {
    schema: ChangePasswordForm.refine(
      async ({ currentPassword, newPassword }) => {
        if (currentPassword && newPassword) {
          const userPassword = await verifyUserPassword({ id: user.id }, currentPassword)
          return userPassword
        }
      },
      {
        message: 'Incorrect password.',
        path: ['currentPassword'],
      },
    ),
    async: true,
  })
  if (submission.status !== 'success') {
    return data(
      submission.reply({
        hideFields: ['currentPassword', 'newPassword', 'confirmNewPassword'],
      }),
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { newPassword } = submission.value

  await new PasswordRepository(db).patchByUserId(user.id, {
    hash: await getPasswordHash(newPassword),
  })

  return redirectWithToast(
    ['/app', params.organizationId, 'settings'].filter(Boolean).join('/'),
    {
      type: 'success',
      title: 'Password Changed',
      description: 'Your password has been changed.',
    },
    { status: 302 },
  )
}

export const handle = {
  breadcrumb: 'Change Password',
}

export default function ChangePassword({ actionData }: Route.ComponentProps) {
  const isPending = useIsPending()

  const [form, fields] = useForm({
    constraint: getZodConstraint(ChangePasswordForm),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ChangePasswordForm })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <>
      <Form method="POST" {...getFormProps(form)}>
        <Field
          className="max-w-72"
          labelProps={{ children: 'Current Password' }}
          inputProps={{
            ...getInputProps(fields.currentPassword, { type: 'password' }),
            autoComplete: 'current-password',
          }}
          errors={fields.currentPassword.errors}
        />
        <Field
          className="max-w-72"
          labelProps={{ children: 'New Password' }}
          inputProps={{
            ...getInputProps(fields.newPassword, { type: 'password' }),
            autoComplete: 'new-password',
          }}
          errors={fields.newPassword.errors}
        />
        <Field
          className="max-w-72"
          labelProps={{ children: 'Confirm New Password' }}
          inputProps={{
            ...getInputProps(fields.confirmNewPassword, {
              type: 'password',
            }),
            autoComplete: 'new-password',
          }}
          errors={fields.confirmNewPassword.errors}
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
            Change Password
          </StatusButton>
        </div>
      </Form>
    </>
  )
}
