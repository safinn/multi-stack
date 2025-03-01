import type { OTPInputProps } from 'input-otp'
import type { CheckboxProps } from './ui/checkbox'
import { useInputControl } from '@conform-to/react'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useId } from 'react'
import { cn } from '~/utils/misc'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './ui/input-otp'
import { Label } from './ui/label'

export type ListOfErrors = Array<string | null | undefined> | null | undefined

export function ErrorList({
  id,
  errors,
}: {
  errors?: ListOfErrors
  id?: string
}) {
  const errorsToRender = errors?.filter(Boolean)
  if (!errorsToRender?.length)
    return null
  return (
    <ul id={id} className="flex flex-col gap-1">
      {errorsToRender.map(e => (
        <li key={e} className="text-xs text-destructive">
          {e}
        </li>
      ))}
    </ul>
  )
}

export function Field({
  labelProps,
  inputProps,
  infoMessage,
  errors,
  className,
}: {
  labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
  infoMessage?: string
  errors?: ListOfErrors
  className?: string
}) {
  const fallbackId = useId()
  const id = inputProps.id ?? fallbackId
  const errorId = errors?.length ? `${id}-error` : undefined

  return (
    <div className={className}>
      <Label htmlFor={id} {...labelProps} className="text-sm font-medium" />
      <Input
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        {...inputProps}
        className="mt-2"
      />
      <div className={cn('mt-2 min-h-6 text-sm', errors?.length ? 'text-destructive' : 'text-muted-foreground')}>
        {errorId ? <ErrorList id={errorId} errors={errors} /> : infoMessage}
      </div>
    </div>
  )
}

export function CheckboxField({
  labelProps,
  buttonProps,
  infoMessage,
  errors,
  className,
}: {
  labelProps: React.ComponentProps<'label'>
  buttonProps: CheckboxProps & {
    name: string
    form: string
    value?: string
  }
  infoMessage?: string
  errors?: ListOfErrors
  className?: string
}) {
  const { key, defaultChecked, ...checkboxProps } = buttonProps
  const fallbackId = useId()
  const checkedValue = buttonProps.value ?? 'on'
  const input = useInputControl({
    key,
    name: buttonProps.name,
    formId: buttonProps.form,
    initialValue: defaultChecked ? checkedValue : undefined,
  })
  const id = buttonProps.id ?? fallbackId
  const errorId = errors?.length ? `${id}-error` : undefined

  return (
    <div className={className}>
      <div className="flex gap-2 items-center">
        <Checkbox
          {...checkboxProps}
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          checked={input.value === checkedValue}
          onCheckedChange={(state) => {
            input.change(state.valueOf() ? checkedValue : '')
            buttonProps.onCheckedChange?.(state)
          }}
          onFocus={(event) => {
            input.focus()
            buttonProps.onFocus?.(event)
          }}
          onBlur={(event) => {
            input.blur()
            buttonProps.onBlur?.(event)
          }}
          type="button"
        />
        <label
          htmlFor={id}
          {...labelProps}
          className="self-center text-body-xs text-muted-foreground"
        />
      </div>
      <div className={cn('mt-2 min-h-6 text-sm', errors?.length ? 'text-destructive' : 'text-muted-foreground')}>
        {errorId ? <ErrorList id={errorId} errors={errors} /> : infoMessage}
      </div>
    </div>
  )
}

export function OTPField({
  labelProps,
  inputProps,
  infoMessage,
  errors,
  className,
}: {
  labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
  inputProps: Partial<OTPInputProps & { render: never }>
  infoMessage?: string
  errors?: ListOfErrors
  className?: string
}) {
  const fallbackId = useId()
  const id = inputProps.id ?? fallbackId
  const errorId = errors?.length ? `${id}-error` : undefined
  return (
    <div className={className}>
      <Label htmlFor={id} {...labelProps} />
      <InputOTP
        pattern={REGEXP_ONLY_DIGITS}
        maxLength={6}
        id={id}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        {...inputProps}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <div className={cn('mt-2 min-h-6 text-sm', errors?.length ? 'text-destructive' : 'text-muted-foreground')}>
        {errorId ? <ErrorList id={errorId} errors={errors} /> : infoMessage}
      </div>
    </div>
  )
}
