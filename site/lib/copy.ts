// Every word on the landing page, in English and Mexican Spanish. Components
// take a Copy and never hold literal text.

export type Lang = 'en' | 'es';

const en = {
  lang: 'en' as Lang,
  locale: 'en-US',
  meta: {
    title: 'Daybook: a painting a day, and a plan to match',
    description:
      'An open-source daily planner hung beside 44 public-domain paintings. Plan the morning, shut down in the evening, and let your AI agents do the typing.',
  },
  nav: { collection: 'The collection', frame: 'Frame', mac: 'Mac', agents: 'Agents', install: 'Install', github: 'GitHub' },
  cta: { open: 'Open Daybook', deploy: 'Deploy your own', code: 'Read the code', download: 'Download for Mac', how: 'How to install' },
  hero: {
    label: 'Open source',
    title: 'A painting a day, and a plan to match.',
    lede: 'An open-source daily planner, hung beside 44 public-domain paintings. Plan the morning, shut down in the evening, and let your AI agents do the typing.',
    plaque: 'Today',
    hangsToday: 'On the wall today',
    hangsOn: 'Hangs next on {date}',
  },
  film: {
    watch: 'Watch the video',
    length: '0:50',
    eyebrow: 'The video',
    title: 'Daybook in fifty seconds.',
    body: 'Plan the morning, work the day, shut down at night and let your agents do the typing: in the browser, on your Mac and on the wall. No sound needed.',
    work: 'Daybook, in fifty seconds',
    medium: '2026 · Moving image, silent · 0:50',
    close: 'Close the video',
  },
  today: {
    caption: 'Today on every Daybook, as the app hangs it',
    source: 'Source',
    plan: 'Plan the day',
    focus: 'Deep work: analytics dashboard',
    schedule: 'Schedule',
    meetings: '2 meetings',
    events: [
      { time: '9:30', title: 'Team standup', note: '' },
      { time: '2:00', title: 'Lunch with Ana', note: 'in 25 min' },
    ],
    toDo: 'To do',
    load: '5h 45m of 6h · 1 of 5 done',
    tasks: [
      { title: 'Write hero and pricing copy', meta: 'Site · Carried over from Monday', est: '2h', tone: 'amber' },
      { title: 'Send invoice to the agency', meta: '', est: '15m', tone: 'done' },
      { title: 'Fix signup redirect loop', meta: 'APP-214 · In Progress in Linear', est: '1h', tone: 'cobalt' },
      { title: "Review Ana's onboarding mocks", meta: '', est: '30m', tone: '' },
      { title: 'Call the bank about the card', meta: '', est: '1h', tone: '' },
    ],
  },
  rotation: {
    title: 'Forty-four paintings.\nOne a day.',
    body: 'Every Daybook and every Frame hangs the same work on the same day: public-domain scans, most from the Art Institute of Chicago. These are the next six weeks.',
    today: 'Today',
    find: 'Find the painting for any date',
    result: 'On {date}, the wall shows',
  },
  rituals: {
    morning: 'Morning',
    morningTitle: 'Plan the morning.',
    evening: 'Evening',
    eveningTitle: 'Shut down at dusk.',
    plan: {
      load: '5h 45m of 6h',
      input: 'Draft deck 45m #client',
      rows: [
        { title: 'Write hero and pricing copy', tag: 'since Mon', est: '2h', tone: 'amber' },
        { title: 'Fix signup redirect loop', tag: 'Linear', est: '1h', tone: 'cobalt' },
        { title: "Review Ana's onboarding mocks", tag: 'Design', est: '30m', tone: '' },
      ],
    },
    shutdown: {
      time: '6:12',
      wrapped: 'Wrapped',
      tally: '4 of 6 done. 2 move on.',
      rows: [
        { title: "Review Ana's onboarding mocks", pick: 0 },
        { title: 'Call the bank about the card', pick: 1 },
      ],
      choices: ['Tomorrow', 'Backlog'],
      journal: 'One line for the journal',
      line: 'Good focus until lunch; the API took longer.',
    },
  },
  frame: {
    label: 'At home',
    title: 'The same painting, on the TV.',
    wallTitle: 'Frame Dashboard',
    wallBody: "Samsung Frame, 9:12 pm. Sisley's The Loire, tomorrow's plan, and today wrapped.",
    wallSync: 'Synced both ways with Daybook.',
    body: "Frame Dashboard is Daybook's sister app for the Samsung Frame. By day the painting fills the wall; after 7 pm it hangs in a gilt frame under a lamp and the wall text turns to tomorrow. Tick a to-do on the TV and it's ticked in Daybook.",
    link: 'Frame Dashboard on GitHub',
    caption: 'The room is an AI-generated photograph. The screen on the wall is a real Frame Dashboard capture.',
    alt: 'A quiet room at night with a Samsung Frame on the wall showing Frame Dashboard: a painting in a gilt frame beside tomorrow’s plan',
  },
  mac: {
    label: 'Daybook for Mac',
    title: 'Today, one click away in the menu bar.',
    body: 'The full app in a window, and today in the menu bar: the focus line, your meetings, the to-dos you can tick or push to tomorrow, and the week. A reminder at 6 pm opens Shut down. It opens with the wall of paintings and keeps itself up to date.',
    link: 'Download for Mac, macOS 14 or later',
    chip: 'Team standup · in 12m',
    clock: 'Tue 9:18',
    alt: 'The Daybook menu bar popover: today, the schedule, four to-dos and the week',
  },
  agents: {
    label: 'MCP, REST and a CLI',
    title: 'Your agents do the typing.',
    command: 'Claude Code',
    prompts: 'Prompts',
    promptList: ['“Plan my day.”', '“Shut down.”', '“Plan my week.”'],
    tools: 'Tools',
    clients: 'Claude, ChatGPT, Cursor, Codex, Grok, Gemini CLI, VS Code, Windsurf, or any MCP client. Settings makes a token for each one.',
  },
  install: {
    title: 'Take it home.',
    lede: 'Three ways to hang it: the Mac app, any browser, or your own cloud. All free.',
    mac: {
      title: 'Daybook for Mac',
      meta: 'macOS 14 or later · Apple silicon and Intel · 25 MB',
      steps: [
        'Download Daybook.dmg and open it.',
        'Drag Daybook into Applications, then open it.',
        'Press Start my day. Your days stay on that Mac, and today appears in the menu bar.',
      ],
      note: 'No account and nothing to set up. For your phone, agents or a Frame TV, connect your own cloud later in Settings. Signed with a Developer ID and notarized by Apple, and it updates itself from then on.',
    },
    web: {
      title: 'In any browser',
      meta: 'Mac, Windows, iPhone, iPad, Android · no account',
      steps: [
        'Open Daybook and press Start. Your days stay in that browser.',
        'Chrome or Edge: click the install icon in the address bar.',
        'Safari on a Mac: File → Add to Dock.',
        'iPhone or iPad: Share → Add to Home Screen.',
      ],
    },
    cloud: {
      title: 'Your own cloud',
      meta: 'Vercel and Upstash · free plans',
      steps: [
        'Deploy with Vercel and add Upstash for Redis to the project.',
        'Set DAYBOOK_KEY (openssl rand -hex 24) and deploy again.',
        'Open it, choose “Open it with your key” at the bottom, and enter the key once per browser.',
        'In Settings, connect the Mac app, your agents, Linear and the Frame.',
      ],
    },
  },
  faq: {
    title: 'At the front desk',
    items: [
      {
        q: 'Is Daybook free?',
        a: 'Yes. Daybook is open source under the MIT license. On this device it needs no account and no server; your own cloud copy runs on the free plans of Vercel and Upstash.',
      },
      {
        q: 'Where are my days stored?',
        a: 'On this device, in your browser’s storage, and nowhere else. In the cloud, in your own Upstash database, behind a key only you hold. You can export everything to one file and import it again.',
      },
      {
        q: 'Which AI agents can use it?',
        a: 'Any client that speaks MCP: Claude, ChatGPT, Cursor, Codex, Grok, Gemini CLI, VS Code and Windsurf among them. There is also a REST API and a small command-line tool.',
      },
      {
        q: 'Do I need a Samsung Frame?',
        a: 'No. The painting of the day hangs in the app on any screen. Frame Dashboard is optional: it puts the same painting and your plan on the TV, and syncs both ways.',
      },
      {
        q: 'Where do the paintings come from?',
        a: '44 public-domain works, scanned by museums and shared on Wikimedia Commons: Monet, Hokusai, Hiroshige, Cézanne, Renoir, Sisley, Homer, Van Gogh and more. Every credit links to its source.',
      },
    ],
  },
  footer: {
    credits: '44 public-domain paintings from Wikimedia Commons, in the same order as Frame Dashboard. Each credit links to its source.',
    docs: 'Docs for agents',
    frame: 'Frame Dashboard',
    license: 'MIT License',
    signing: 'Code signing policy',
    other: 'Español',
    otherHref: '/es',
  },
  signing: {
    meta: {
      title: 'Code signing policy · Daybook',
      description: 'How Daybook for Windows is signed, who approves each release, and what the app sends over the network: nothing you didn’t ask for.',
    },
    eyebrow: 'Daybook for Windows',
    title: 'Code signing policy',
    lede: 'The Windows installers are signed, so Windows can show who published Daybook and confirm nobody changed it after it was built.',
    attribution: {
      before: 'Free code signing provided by ',
      between: ', certificate by ',
      after: '.',
    },
    signedTitle: 'What is signed',
    signed:
      'Daybook-setup.exe and Daybook.msi, attached to the GitHub releases tagged windows-v*. GitHub Actions builds them from the source in this repository; nothing built elsewhere is signed.',
    rolesTitle: 'Who decides',
    committers: 'Committers and reviewers',
    committersNote: 'Write code and review every pull request from anyone else.',
    approvers: 'Approvers',
    approversNote: 'Approve each release by hand before it is signed.',
    privacyTitle: 'Privacy',
    privacy:
      'Daybook for Windows will not transfer any information to other networked systems unless specifically requested by the user. Your days stay on your PC, in Daybook’s own storage. The app has no analytics and no tracking.',
    back: 'Back to Daybook',
  },
  consent: {
    // {tools}: the ones switched on, e.g. "Google Analytics" or "Google Analytics and Microsoft Clarity".
    text: 'We use {tools} to see how this page is read.',
    and: 'and',
    accept: 'Accept',
    reject: 'Decline analytics',
  },
};

export type Copy = typeof en;

const es: Copy = {
  lang: 'es',
  locale: 'es-MX',
  meta: {
    title: 'Daybook: una pintura al día y un plan a la altura',
    description:
      'Un planificador diario de código abierto junto a 44 pinturas de dominio público. Planea la mañana, cierra el día al atardecer y deja que tus agentes escriban.',
  },
  nav: { collection: 'La colección', frame: 'Frame', mac: 'Mac', agents: 'Agentes', install: 'Instalar', github: 'GitHub' },
  cta: {
    open: 'Abrir Daybook',
    deploy: 'Despliega el tuyo',
    code: 'Ver el código',
    download: 'Descargar para Mac',
    how: 'Cómo instalarlo',
  },
  hero: {
    label: 'Código abierto',
    title: 'Una pintura al día, y un plan a la altura.',
    lede: 'Un planificador diario de código abierto, colgado junto a 44 pinturas de dominio público. Planea la mañana, cierra el día al atardecer y deja que tus agentes de IA escriban por ti.',
    plaque: 'Hoy',
    hangsToday: 'En el muro hoy',
    hangsOn: 'Vuelve a colgarse el {date}',
  },
  film: {
    watch: 'Ver el video',
    length: '0:50',
    eyebrow: 'El video',
    title: 'Daybook en cincuenta segundos.',
    body: 'Planea la mañana, trabaja el día, cierra al atardecer y deja que tus agentes escriban por ti: en el navegador, en tu Mac y en la pared. No necesita sonido.',
    work: 'Daybook, en cincuenta segundos',
    medium: '2026 · Imagen en movimiento, sin sonido, en inglés · 0:50',
    close: 'Cerrar el video',
  },
  today: {
    caption: 'Hoy en cada Daybook, como lo cuelga la app',
    source: 'Fuente',
    plan: 'Planear el día',
    focus: 'Trabajo profundo: tablero de analítica',
    schedule: 'Agenda',
    meetings: '2 reuniones',
    events: [
      { time: '9:30', title: 'Junta diaria del equipo', note: '' },
      { time: '2:00', title: 'Comida con Ana', note: 'en 25 min' },
    ],
    toDo: 'Por hacer',
    load: '5h 45m de 6h · 1 de 5 hechas',
    tasks: [
      { title: 'Escribir el texto de portada y precios', meta: 'Sitio · Viene del lunes', est: '2h', tone: 'amber' },
      { title: 'Mandar la factura a la agencia', meta: '', est: '15m', tone: 'done' },
      { title: 'Arreglar el bucle de redirección del registro', meta: 'APP-214 · En curso en Linear', est: '1h', tone: 'cobalt' },
      { title: 'Revisar los bocetos de onboarding de Ana', meta: '', est: '30m', tone: '' },
      { title: 'Llamar al banco por la tarjeta', meta: '', est: '1h', tone: '' },
    ],
  },
  rotation: {
    title: 'Cuarenta y cuatro pinturas.\nUna al día.',
    body: 'Cada Daybook y cada Frame cuelgan la misma obra el mismo día: escaneos de dominio público, casi todos del Art Institute of Chicago. Estas son las próximas seis semanas.',
    today: 'Hoy',
    find: 'Busca la pintura de cualquier fecha',
    result: 'El {date}, el muro muestra',
  },
  rituals: {
    morning: 'Mañana',
    morningTitle: 'Planea la mañana.',
    evening: 'Tarde',
    eveningTitle: 'Cierra el día al atardecer.',
    plan: {
      load: '5h 45m de 6h',
      input: 'Preparar deck 45m #cliente',
      rows: [
        { title: 'Escribir el texto de portada y precios', tag: 'desde el lun', est: '2h', tone: 'amber' },
        { title: 'Arreglar el bucle de redirección', tag: 'Linear', est: '1h', tone: 'cobalt' },
        { title: 'Revisar los bocetos de Ana', tag: 'Diseño', est: '30m', tone: '' },
      ],
    },
    shutdown: {
      time: '6:12',
      wrapped: 'Cerrado',
      tally: '4 de 6 hechas. 2 siguen.',
      rows: [
        { title: 'Revisar los bocetos de Ana', pick: 0 },
        { title: 'Llamar al banco por la tarjeta', pick: 1 },
      ],
      choices: ['Mañana', 'Pendientes'],
      journal: 'Una línea para el diario',
      line: 'Buen enfoque hasta la comida; la API tomó más tiempo.',
    },
  },
  frame: {
    label: 'En casa',
    title: 'La misma pintura, en la tele.',
    wallTitle: 'Frame Dashboard',
    wallBody: 'Samsung Frame, 9:12 pm. El Loira de Sisley, el plan de mañana y el día cerrado.',
    wallSync: 'Sincronizado en ambos sentidos con Daybook.',
    body: 'Frame Dashboard es la app hermana de Daybook para la Samsung Frame. De día la pintura llena el muro; después de las 7 pm cuelga en un marco dorado bajo una lámpara y el texto del muro pasa a mañana. Marca una tarea en la tele y queda marcada en Daybook.',
    link: 'Frame Dashboard en GitHub',
    caption: 'La habitación es una fotografía generada con IA. La pantalla del muro es una captura real de Frame Dashboard.',
    alt: 'Una habitación tranquila de noche con una Samsung Frame en el muro que muestra Frame Dashboard: una pintura en marco dorado junto al plan de mañana',
  },
  mac: {
    label: 'Daybook para Mac',
    title: 'Hoy, a un clic en la barra de menús.',
    body: 'La app completa en una ventana, y el día en la barra de menús: el enfoque, tus reuniones, las tareas que marcas o mandas a mañana, y la semana. Un recordatorio a las 6 pm abre el cierre del día. Abre con el muro de pinturas y se mantiene al día sola.',
    link: 'Descárgala para Mac, macOS 14 o posterior',
    chip: 'Junta diaria · en 12m',
    clock: 'mar 9:18',
    alt: 'El panel de Daybook en la barra de menús: hoy, la agenda, cuatro tareas y la semana',
  },
  agents: {
    label: 'MCP, REST y una CLI',
    title: 'Tus agentes escriben por ti.',
    command: 'Claude Code',
    prompts: 'Prompts',
    promptList: ['“Planea mi día.”', '“Cierra el día.”', '“Planea mi semana.”'],
    tools: 'Herramientas',
    clients:
      'Claude, ChatGPT, Cursor, Codex, Grok, Gemini CLI, VS Code, Windsurf o cualquier cliente MCP. Ajustes crea un token para cada uno.',
  },
  install: {
    title: 'Llévatelo a casa.',
    lede: 'Tres maneras de colgarlo: la app de Mac, cualquier navegador o tu propia nube. Todas gratis.',
    mac: {
      title: 'Daybook para Mac',
      meta: 'macOS 14 o posterior · Apple silicon e Intel · 25 MB',
      steps: [
        'Descarga Daybook.dmg y ábrelo.',
        'Arrastra Daybook a Aplicaciones y ábrelo.',
        'Presiona Empezar mi día. Tus días se quedan en esa Mac y el día aparece en la barra de menús.',
      ],
      note: 'Sin cuenta y sin nada que configurar. Para tu teléfono, tus agentes o una tele Frame, conecta tu propia nube después en Ajustes. Firmada con Developer ID y notarizada por Apple, y desde ahí se actualiza sola.',
    },
    web: {
      title: 'En cualquier navegador',
      meta: 'Mac, Windows, iPhone, iPad, Android · sin cuenta',
      steps: [
        'Abre Daybook y toca Empezar. Tus días se quedan en ese navegador.',
        'Chrome o Edge: el ícono de instalar en la barra de direcciones.',
        'Safari en Mac: Archivo → Agregar al Dock.',
        'iPhone o iPad: Compartir → Agregar a inicio.',
      ],
    },
    cloud: {
      title: 'Tu propia nube',
      meta: 'Vercel y Upstash · planes gratuitos',
      steps: [
        'Despliega en Vercel y agrega Upstash for Redis al proyecto.',
        'Define DAYBOOK_KEY (openssl rand -hex 24) y despliega de nuevo.',
        'Ábrelo, elige “Ábrelo con tu llave” abajo y escribe la llave una vez por navegador.',
        'En Ajustes, conecta la app de Mac, tus agentes, Linear y la Frame.',
      ],
    },
  },
  faq: {
    title: 'En el mostrador',
    items: [
      {
        q: '¿Daybook es gratis?',
        a: 'Sí. Daybook es de código abierto con licencia MIT. En este dispositivo no necesita cuenta ni servidor; tu copia en la nube corre en los planes gratuitos de Vercel y Upstash.',
      },
      {
        q: '¿Dónde se guardan mis días?',
        a: 'En este dispositivo, en el almacenamiento de tu navegador y en ningún otro lugar. En la nube, en tu propia base de Upstash, detrás de una llave que solo tú tienes. Puedes exportar todo a un archivo e importarlo de nuevo.',
      },
      {
        q: '¿Qué agentes de IA pueden usarlo?',
        a: 'Cualquier cliente que hable MCP: Claude, ChatGPT, Cursor, Codex, Grok, Gemini CLI, VS Code y Windsurf, entre otros. También hay una API REST y una pequeña herramienta de línea de comandos.',
      },
      {
        q: '¿Necesito una Samsung Frame?',
        a: 'No. La pintura del día cuelga en la app en cualquier pantalla. Frame Dashboard es opcional: pone la misma pintura y tu plan en la tele, y sincroniza en ambos sentidos.',
      },
      {
        q: '¿De dónde vienen las pinturas?',
        a: '44 obras de dominio público, escaneadas por museos y compartidas en Wikimedia Commons: Monet, Hokusai, Hiroshige, Cézanne, Renoir, Sisley, Homer, Van Gogh y más. Cada crédito enlaza a su fuente.',
      },
    ],
  },
  footer: {
    credits: '44 pinturas de dominio público de Wikimedia Commons, en el mismo orden que Frame Dashboard. Cada crédito enlaza a su fuente.',
    docs: 'Docs para agentes',
    frame: 'Frame Dashboard',
    license: 'Licencia MIT',
    signing: 'Política de firma de código',
    other: 'English',
    otherHref: '/',
  },
  signing: {
    meta: {
      title: 'Política de firma de código · Daybook',
      description: 'Cómo se firma Daybook para Windows, quién aprueba cada versión y qué envía la app por la red: nada que no hayas pedido.',
    },
    eyebrow: 'Daybook para Windows',
    title: 'Política de firma de código',
    lede: 'Los instaladores de Windows van firmados, así Windows puede mostrar quién publica Daybook y confirmar que nadie lo cambió después de compilarlo.',
    // SignPath Foundation's required wording, kept in English.
    attribution: {
      before: 'Free code signing provided by ',
      between: ', certificate by ',
      after: '.',
    },
    signedTitle: 'Qué se firma',
    signed:
      'Daybook-setup.exe y Daybook.msi, adjuntos a las versiones de GitHub con etiqueta windows-v*. GitHub Actions los compila desde el código de este repositorio; nada compilado en otro lado se firma.',
    rolesTitle: 'Quién decide',
    committers: 'Autores y revisores',
    committersNote: 'Escriben el código y revisan cada pull request de cualquier otra persona.',
    approvers: 'Aprobadores',
    approversNote: 'Aprueban a mano cada versión antes de firmarla.',
    privacyTitle: 'Privacidad',
    privacy:
      'Daybook para Windows no transfiere información a otros sistemas en red, salvo que la persona usuaria lo pida expresamente. Tus días se quedan en tu PC, en el almacenamiento de Daybook. La app no tiene analítica ni rastreo.',
    back: 'Volver a Daybook',
  },
  consent: {
    text: 'Usamos {tools} para ver cómo se lee esta página.',
    and: 'y',
    accept: 'Aceptar',
    reject: 'Rechazar analítica',
  },
};

export const copy: Record<Lang, Copy> = { en, es };
