// Централизованные иконки (lucide-react) — замена эмодзи.
// Судья №3: эмодзи 🚆⛴🚚 = «студент за вечер». Один icon-set = дизайн-система.
import {
  TrainFront, Ship, Truck, Package, MapPin,
  Clock, CheckCircle2, AlertTriangle, DollarSign,
  Anchor, Warehouse, ArrowRight,
} from 'lucide-react'

// транспорт по типу плеча
export const TransportIcon = ({ type, ...props }) => {
  const map = { rail: TrainFront, sea_ferry: Ship, truck: Truck, other: Package }
  const Ico = map[type] || Package
  return <Ico {...props} />
}

// иконка стадии (по коду) — для бейджей/степпера
export function StageIcon({ code, ...props }) {
  if (code === 'ferry_wait') return <Clock {...props} />
  if (code === 'ferry') return <Anchor {...props} />
  if (code === 'delivered' || code === 'empty_returned') return <CheckCircle2 {...props} />
  if (code === 'customs_az' || code === 'customs_uz') return <Warehouse {...props} />
  return <Package {...props} />
}

export {
  TrainFront, Ship, Truck, Package, MapPin,
  Clock, CheckCircle2, AlertTriangle, DollarSign,
  Anchor, Warehouse, ArrowRight,
}
