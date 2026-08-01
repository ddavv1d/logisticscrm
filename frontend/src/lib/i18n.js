import { createContext, useContext, useState, createElement } from 'react'

// Русский по умолчанию + переключатель EN (по требованию Давида).
const STRINGS = {
  ru: {
    app: 'LogisticsCRM',
    login: 'Вход', email: 'Email', password: 'Пароль', signIn: 'Войти',
    loginError: 'Неверный email или пароль',
    dashboard: 'Дашборд', containers: 'Контейнеры', receivables: 'Дебиторка',
    logout: 'Выйти',
    // dashboard
    whereMoney: 'Где деньги', whereStuck: 'Где застряло', inTransit: 'В пути',
    receivable: 'К получению', margin: 'Маржа', overdue: 'Просрочено', delivered: 'Доставлено',
    activity: 'Что изменилось', stuckContainers: 'Застрявшие контейнеры',
    byCorridorStage: 'По этапам коридора', noStuck: 'Застрявших нет — всё движется',
    // list
    search: 'Поиск по № или клиенту…', newContainer: 'Новый контейнер', exportXlsx: 'Выгрузить в Excel',
    all: 'Все', flagged: 'На контроле', ferryWait: 'Ожидание парома', stuck: 'Застряло',
    ref: 'Ref / Конт. №', client: 'Клиент', route: 'Маршрут', stage: 'Стадия',
    daysOnStage: 'Дней', manager: 'Менеджер', empty: 'Контейнеров не найдено',
    // detail
    back: 'Назад', legOf: 'Плечо', of: 'из', history: 'История стадий', money: 'Финансы',
    nextStage: 'Следующая', changeStage: 'Сменить стадию', comment: 'Комментарий',
    save: 'Сохранить', saved: 'Сохранено', legs: 'Плечи', income: 'Доход', expense: 'Расход',
    addCharge: 'Добавить строку', currency: 'Валюта', amount: 'Сумма', rate: 'Курс к USD',
    paid: 'Оплачено', dueDate: 'Срок', outstanding: 'Остаток', noMoney: 'Финансы недоступны для вашей роли',
    // create
    createTitle: 'Новый контейнер', containerNo: '№ контейнера (ISO 6346)', containerType: 'Тип',
    applyPreset: 'Шаблон «Средний коридор» (4 плеча)', create: 'Создать', cancel: 'Отмена',
    optional: 'необязательно',
  },
  en: {
    app: 'LogisticsCRM',
    login: 'Sign in', email: 'Email', password: 'Password', signIn: 'Sign in',
    loginError: 'Invalid email or password',
    dashboard: 'Dashboard', containers: 'Containers', receivables: 'Receivables',
    logout: 'Log out',
    whereMoney: 'Where the money is', whereStuck: 'Where it is stuck', inTransit: 'In transit',
    receivable: 'Receivable', margin: 'Margin', overdue: 'Overdue', delivered: 'Delivered',
    activity: 'Recent activity', stuckContainers: 'Stuck containers',
    byCorridorStage: 'By corridor stage', noStuck: 'Nothing stuck — all moving',
    search: 'Search by ref or client…', newContainer: 'New container', exportXlsx: 'Export to Excel',
    all: 'All', flagged: 'Flagged', ferryWait: 'Ferry wait', stuck: 'Stuck',
    ref: 'Ref / Cont. No', client: 'Client', route: 'Route', stage: 'Stage',
    daysOnStage: 'Days', manager: 'Manager', empty: 'No containers found',
    back: 'Back', legOf: 'Leg', of: 'of', history: 'Stage history', money: 'Finance',
    nextStage: 'Next', changeStage: 'Change stage', comment: 'Comment',
    save: 'Save', saved: 'Saved', legs: 'Legs', income: 'Income', expense: 'Expense',
    addCharge: 'Add line', currency: 'Currency', amount: 'Amount', rate: 'Rate to USD',
    paid: 'Paid', dueDate: 'Due', outstanding: 'Outstanding', noMoney: 'Finance is not available for your role',
    createTitle: 'New container', containerNo: 'Container No (ISO 6346)', containerType: 'Type',
    applyPreset: '“Middle Corridor” preset (4 legs)', create: 'Create', cancel: 'Cancel',
    optional: 'optional',
  },
}

const I18nCtx = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lc_lang') || 'ru')
  const set = (l) => {
    localStorage.setItem('lc_lang', l)
    setLang(l)
  }
  const t = (key) => STRINGS[lang][key] ?? key
  return createElement(I18nCtx.Provider, { value: { lang, setLang: set, t } }, children)
}

export const useI18n = () => useContext(I18nCtx)
