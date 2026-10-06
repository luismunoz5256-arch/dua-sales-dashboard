import { ComingSoon } from '../components/ui'

export default function WeekPage() {
  return (
    <ComingSoon step={4}>
      <p>A suggested Mon–Sat visit plan, one area cluster per day, that you can drag to adjust.</p>
      <p>Tap a day to mark it as a Warehouse day; its visits move to other days.</p>
    </ComingSoon>
  )
}
