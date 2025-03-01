import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as React from 'react'
import { cn } from '~/utils/misc'
import { Icon } from './icon'

export type CheckboxProps = Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  'type'
> & {
  type?: string
}

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 size-4 shrink-0 rounded-[4px] border shadow-xs transition-[color,box-shadow] focus-visible:ring-4 focus-visible:outline-1 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:focus-visible:ring-0',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Icon name="check" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
