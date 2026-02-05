interface TimerCardProps {
  timerId: 1 | 2 | 3
  label: string
  isActive: boolean
  formattedTime: string
  onToggle: (timerId: 1 | 2 | 3) => void
  onLabelChange: (timerId: 1 | 2 | 3, value: string) => void
}

export const TimerCard = ({
  timerId,
  label,
  isActive,
  formattedTime,
  onToggle,
  onLabelChange,
}: TimerCardProps) => {
  return (
    <article className={`app__card${isActive ? ' app__card--active' : ''}`}>
      <input
        className="app__card-input"
        value={label}
        onChange={(event) => onLabelChange(timerId, event.target.value)}
        placeholder={`Timer ${timerId}`}
      />
      <p className="app__card-time">{formattedTime}</p>
      <button
        className={`app__card-button${
          isActive ? ' app__card-button--stop' : ''
        }`}
        type="button"
        onClick={() => onToggle(timerId)}
      >
        {isActive ? 'Stop' : 'Start'}
      </button>
    </article>
  )
}
