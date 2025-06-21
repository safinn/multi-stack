import type { VariantProps } from 'class-variance-authority'
import type { buttonVariants } from './button'
import * as React from 'react'
import { useSpinDelay } from 'spin-delay'
import { cn } from '~/utils/misc'
import { Button } from './button'
import { Icon } from './icon'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

export function StatusButton({ ref, message, status, className, children, spinDelay, ...props }: React.ComponentProps<'button'>
  & VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  } & {
    status: 'pending' | 'success' | 'error' | 'idle'
    message?: string | null
    spinDelay?: Parameters<typeof useSpinDelay>[1]
  } & { ref?: React.RefObject<HTMLButtonElement | null> }) {
  const delayedPending = useSpinDelay(status === 'pending', {
    delay: 400,
    minDuration: 300,
    ...spinDelay,
  })
  const companion = {
    pending: delayedPending
      ? (
          <div
            role="status"
            className="inline-flex h-6 w-6 items-center justify-center"
          >
            <Icon name="loading" className="animate-spin" title="loading" />
          </div>
        )
      : null,
    success: (
      <div
        role="status"
        className="inline-flex h-6 w-6 items-center justify-center"
      >
        <Icon name="check" title="success" />
      </div>
    ),
    error: (
      <div
        role="status"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive"
      >
        <Icon
          name="cross"
          className="text-destructive-foreground"
          title="error"
        />
      </div>
    ),
    idle: null,
  }[status]

  return (
    <Button
      ref={ref}
      className={cn('flex justify-center gap-2', className)}
      {...props}
    >
      <div>{children}</div>
      {message
        ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>{companion}</TooltipTrigger>
                <TooltipContent>{message}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        : (
            companion
          )}
    </Button>
  )
}
StatusButton.displayName = 'Button'
