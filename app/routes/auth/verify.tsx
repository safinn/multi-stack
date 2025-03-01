import type { Route } from './+types/verify'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { useRef } from 'react'
import { Form, useSearchParams } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { OTPField } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { validateRequest } from '~/utils/auth/verify.server'
import { checkHoneypot } from '~/utils/honeypot.server'
import { useIsPending } from '~/utils/misc'

const types = ['onboarding', 'reset-password', 'change-email', '2fa'] as const
export const VerificationTypeSchema = z.enum(types)
export type VerificationTypes = z.infer<typeof VerificationTypeSchema>

export const codeQueryParam = 'code'
export const targetQueryParam = 'target'
export const typeQueryParam = 'type'
export const redirectToQueryParam = 'redirectTo'

export const VerifySchema = z.object({
  [codeQueryParam]: z.string().min(6).max(6),
  [typeQueryParam]: VerificationTypeSchema,
  [targetQueryParam]: z.string(),
  [redirectToQueryParam]: z.string().optional(),
})

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  checkHoneypot(formData)
  return validateRequest(request, formData)
}

export default function Verify({ actionData }: Route.ComponentProps) {
  const isPending = useIsPending()
  const [searchParams] = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)
  const parseWithZodType = VerificationTypeSchema.safeParse(
    searchParams.get(typeQueryParam),
  )
  const type = parseWithZodType.success ? parseWithZodType.data : null

  const [form, fields] = useForm({
    constraint: getZodConstraint(VerifySchema),
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifySchema })
    },
    defaultValue: {
      code: searchParams.get(codeQueryParam) ?? '',
      type,
      target: searchParams.get(targetQueryParam),
      redirectTo: searchParams.get(redirectToQueryParam),
    },
  })

  return (
    <>
      <Form ref={formRef} method="POST" {...getFormProps(form)}>
        <HoneypotInputs />
        <OTPField
          labelProps={{
            htmlFor: fields[codeQueryParam].id,
            children: 'Code',
          }}
          inputProps={{
            ...getInputProps(fields[codeQueryParam], { type: 'text' }),
            autoComplete: 'one-time-code',
            autoFocus: true,
          }}
          errors={fields[codeQueryParam].errors}
        />

        <input {...getInputProps(fields[typeQueryParam], { type: 'hidden' })} />
        <input {...getInputProps(fields[targetQueryParam], { type: 'hidden' })} />
        <input {...getInputProps(fields[redirectToQueryParam], { type: 'hidden' })} />
        <StatusButton
          className="mt-6"
          status={isPending ? 'pending' : (form.status ?? 'idle')}
          type="submit"
          disabled={isPending}
        >
          Submit code
        </StatusButton>
      </Form>
    </>
  )
}
