export const formatSeconds = (value: number): string => {
  const total = Math.max(0, Math.floor(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':')
}
