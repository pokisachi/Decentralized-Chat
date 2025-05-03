export function Card({ children, className }) {
  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return (
    <div className={`px-6 py-4 border-b ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }) {
  return (
    <h2 className={`text-xl font-semibold ${className}`}>
      {children}
    </h2>
  )
}

export function CardContent({ children, className }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className }) {
  return (
    <div className={`px-6 py-4 border-t text-center text-sm text-gray-500 ${className}`}>
      {children}
    </div>
  )
}
