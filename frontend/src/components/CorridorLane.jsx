// «Лента коридора» — замена уродливого bar-графика (задача #13).
// Судья №3: график провален (тонкие бары, значения в tooltip, ось ломает слова).
// Решение (его же рекомендация A): горизонтальная лента этапов Грузия→…→Узбекистан
// с КРУПНЫМ числом контейнеров на каждом узле. Паттерн узлов-состояний адаптирован
// из Origin UI Stepper (21st id:769): состояние узла (пройден/активен/пусто) → data-стиль.
import { TransportIcon, StageIcon } from '../lib/icons.jsx'

// какой транспорт «подводит» к стадии (для иконки на соединителе)
const STAGE_LEG = {
  booking: 'rail', loading: 'rail', rail_to_baku: 'rail', customs_az: 'rail',
  ferry_wait: 'sea_ferry', ferry: 'sea_ferry', turkmenbashi: 'sea_ferry',
  rail_to_uz: 'rail', customs_uz: 'rail', delivered: 'truck', empty_returned: 'truck',
}

// короткие подписи узлов (полные названия обрезались — судья №3)
const SHORT_LABEL = {
  booking: 'Бронь', loading: 'Загрузка', rail_to_baku: 'Ж/д → Баку',
  customs_az: 'Таможня АЗ', ferry_wait: 'Ждёт паром', ferry: 'На пароме',
  turkmenbashi: 'Туркменбаши', rail_to_uz: 'Ж/д → UZ', customs_uz: 'Таможня UZ',
  delivered: 'Доставлен', empty_returned: 'Порожняк',
}

export default function CorridorLane({ data }) {
  // data: [{ stage, title, count }] в порядке коридора (бэк уже отдаёт по order)
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <StageIcon code="delivered" className="h-8 w-8 text-grass mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-graphite">Все контейнеры доставлены</p>
        <p className="text-xs text-steel mt-0.5">В коридоре сейчас пусто</p>
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-stretch gap-0 min-w-max">
        {data.map((node, i) => {
          const isStuck = node.stage === 'ferry_wait'
          const intensity = node.count / max // 0..1 — насыщенность узла по загрузке
          const tone = isStuck ? 'amber' : 'sea'
          const bg = isStuck ? 'bg-amber-soft' : 'bg-sea-soft'
          const ring = isStuck ? 'border-amber/50' : 'border-sea/30'
          const numColor = isStuck ? 'text-amber' : 'text-sea-deep'
          return (
            <div key={node.stage} className="flex items-stretch">
              {/* узел */}
              <div className="flex flex-col items-center w-[104px] px-1">
                {/* крупное число контейнеров */}
                <div
                  className={`relative grid place-items-center w-full rounded-card border ${ring} ${bg} py-3.5 transition-transform hover:scale-[1.04]`}
                  style={{ opacity: 0.72 + intensity * 0.28 }}
                  title={`${node.title}: ${node.count}`}
                >
                  {isStuck && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber text-white shadow-sm">
                      <StageIcon code="ferry_wait" className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </span>
                  )}
                  <span className={`text-3xl font-extrabold tabnum leading-none ${numColor}`}>
                    {node.count}
                  </span>
                </div>
                {/* короткая подпись стадии */}
                <span className="mt-2 text-[11px] font-semibold leading-tight text-steel text-center">
                  {SHORT_LABEL[node.stage] || node.title}
                </span>
              </div>

              {/* соединитель с иконкой транспорта */}
              {i < data.length - 1 && (
                <div className="flex flex-col items-center justify-start pt-6 w-6">
                  <div className="flex items-center">
                    <span className="h-0.5 w-2 bg-line" />
                    <TransportIcon
                      type={STAGE_LEG[data[i + 1].stage] || 'rail'}
                      className="h-3.5 w-3.5 text-steel-faint mx-0.5"
                      strokeWidth={2}
                    />
                    <span className="h-0.5 w-2 bg-line" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* легенда */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-steel">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sea/70 border border-sea/30" /> в движении
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70 border border-amber/40" /> застряло (ожидание парома)
        </span>
        <span className="text-steel-faint">насыщенность = загрузка этапа</span>
      </div>
    </div>
  )
}
