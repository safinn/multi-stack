import type { To } from 'react-router'
import { Link } from 'react-router'
import { cn } from '~/utils/misc'
import { Button } from './ui/button'
import { Icon } from './ui/icon'

export default function ArrowLink({ children, to, direction = 'right' }: React.PropsWithChildren<{ to: To, direction?: 'left' | 'right' }>) {
  const arrowDirection = direction === 'left' ? 'arrow-left' : 'arrow-right'
  const arrowAnimation = direction === 'left' ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'

  return (
    <Link to={to}>
      <Button className="group" variant="link">
        <Icon
          className={cn('-ms-1 me-2 opacity-60 transition-transform group-hover:translate-x-0.5', arrowAnimation)}
          name={arrowDirection}
          strokeWidth={2}
          aria-hidden="true"
        />
        {children}
      </Button>
    </Link>
  )
}
