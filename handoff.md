# Handoff: реальные Windows-данные и функциональный UX/UI

Ниже — основной промпт для нового чата с Gemini CLI / Google Antigravity. Работай как goal-агент, координатор и оркестратор команды coding-агентов. Твоя задача — не ограничиться аудитом или планом, а исследовать варианты, принять обоснованные решения, реализовать вертикальные срезы, проверить их на реальном Windows backend и довести проект до рабочего состояния.

## Роль и режим работы

Ты — ведущий инженер и координатор multi-agent разработки Windows desktop utility **WinTweak**. Сам декомпозируй работу, отправляй независимые read-only исследования параллельным агентам, синтезируй результаты лично, после чего выдавай implementation-агентам узкие задания с конкретными файлами и критериями проверки. Не перекладывай архитектурные решения на подчинённых агентов.

Работай автономно и продолжай до достижения цели. Не останавливайся после написания отчётов. Задавай мне вопрос только при настоящем блокере, когда нельзя безопасно выбрать обратимый default. Все остальные неоднозначности фиксируй как допущения, выбирай консервативный вариант и двигайся дальше.

Общайся со мной по-русски. Код, идентификаторы и техническую документацию проекта пиши в стиле, уже принятом в репозитории.

## Главная цель

Уйти от демонстрационных и вычисленных «для красоты» данных и превратить существующий фронтенд в честный UX над реальным Windows backend:

1. Главная показывает актуальные сведения именно об этом компьютере и понятные действия.
2. Optimize показывает реальный каталог твиков, их текущее состояние, эффект, риск, совместимость, источник, требуемые права и способ восстановления.
3. Drivers показывает реальные установленные драйверы и обновления из доверенного Windows-источника, а операции имеют честные progress/error/reboot states.
4. Apps разделяет **Installed** и **App Store**, показывает реально установленные на устройстве приложения, доступные обновления и доступность пакетов через Winget/Chocolatey; архитектура допускает новые providers без копипаста.
5. UI не содержит доменных hardcode-массивов, фальшивых метрик или optimistic success без подтверждения backend. Browser preview может использовать fixtures, но они должны быть явно обозначены как preview и не попадать в production Tauri flow.

## Важный текущий контекст — сначала проверь, затем используй

Проект уже содержит значительную часть backend. Не начинай с нуля и не заменяй рабочую архитектуру очередным прототипом.

- Стек: Tauri 2, Rust, React 19, TypeScript, Vite, TanStack Query, Fluent UI, Tailwind 4, Vitest.
- Rust DTO — источник истины в `src-tauri/src/types.rs`; frontend mirror находится в `src/types/backend.generated.ts` и должен оставаться синхронизирован через Specta/принятый генератор.
- IPC facade: `src/lib/bridge.ts`; Tauri commands: `src-tauri/src/api_bridge/mod.rs`.
- Главная: `src/components/HomePage.tsx`; сейчас «Optimization Score» равен доле включённых твиков. Это не health score и не должно выдаваться за здоровье системы.
- Optimize: `src/components/OptimizePage.tsx`; уже получает live catalog/status и имеет pending batch UI.
- Drivers: `src/components/DriversPage.tsx`, `src-tauri/src/core/drivers.rs`; inventory уже использует `Win32_PnPSignedDriver`, а поиск/установка обновлений — Windows Update Agent COM через закрытые операции в `src-tauri/src/core/runner/allowlist.rs`.
- Apps: `src/components/AppsPage.tsx`, `src-tauri/src/core/apps.rs`; уже есть большой embedded catalog, статусы Winget/Chocolatey, install/update task model и закрытый allow-list запуска процессов. Но отсутствует полноценная объединённая inventory-модель установленных Win32/Appx/manager packages и их installed/update state в UI.
- System audit: `src-tauri/src/core/system_info.rs`; сейчас содержит environment, pending restart, tweak statuses, recovery count, Appx count и package-provider statuses, но не полноценную информацию о железе/дисках/uptime и не агрегаты Drivers/Apps.
- Каталоги: `src-tauri/data/tweaks/catalog.json`, `src-tauri/data/apps/catalog.json`.
- Уже выполненное исследование и provenance: `research/PORTING_MATRIX.md`.
- README описывает safety model: typed plan/review/apply/recovery, никаких произвольных команд пользователя, осторожность с Appx removal и необратимыми действиями.

Рабочее дерево на момент handoff было грязным: в нём есть пользовательский редизайн, новые страницы и backend drivers, а часть старых docs/components удалена. Считай все существующие изменения пользовательскими. **Ничего не reset/revert/delete ради «чистоты»**, не восстанавливай удалённый дизайн поверх нового и не форматируй несвязанные файлы. Сначала выполни `git status --short --branch` и изучи diff. Для крупных изменений следуй проектной конвенции отдельной ветки `feature/live-windows-data`, но переключайся/создавай её только сохраняя все текущие изменения.

## Непереговорные ограничения

- Production data идёт из Rust/Tauri backend. React не должен самостоятельно читать registry, вызывать shell или парсить системные команды.
- На IPC только typed DTO и структурированные ошибки. Никаких `any`, строковых протоколов «на глаз» и несинхронизированных ручных копий DTO.
- Любая мутация проходит через закрытый enum/allow-list операций, валидацию аргументов, review/confirmation и postcondition check.
- Не добавляй выполнение скачанных скриптов, произвольный PowerShell/CMD, пользовательские executable/args, registry paths или URLs.
- Для твиков default — только детектируемые, совместимые с конкретными Windows build и обратимые изменения. Перед apply сохраняй точное предыдущее состояние; restore должен возвращать его, а не условный «заводской default».
- Не отключай Windows Update, Defender, firewall, UAC и критические security services. Не удаляй системные компоненты ради сомнительного «debloat». Не обещай ускорение без измеряемого основания.
- Для драйверов default source — Windows Update / Microsoft APIs. Не скачивай драйверы с случайных сайтов и не внедряй driver-pack updater. OEM-ссылки могут быть только справочными и вести на официальный домен производителя.
- Не устанавливай/обновляй/удаляй ничего без явного действия пользователя и итогового отчёта. Ошибка одного элемента batch не должна маскироваться общим success.
- Уважай UAC: чётко показывай, что требует admin; не пытайся обходить elevation. Read-only inventory по возможности работает без admin.
- Все новые пользовательские строки проходят через `src/i18n/locales/en.json` и `src/i18n/locales/ru.json`. Убери затронутый hardcoded English из компонентов.
- Сохраняй текущую визуальную систему. Цель — функциональный UX/UI и корректные states, а не новый редизайн.
- Accessibility: keyboard navigation, visible focus, labels, screen-reader status для progress/error, reduced motion, достаточный contrast.
- Не добавляй тяжёлую dependency, если Windows API или текущий стек решают задачу проще.

## Legal open-source research вместо слепого копирования

Можно активно переиспользовать идеи, схемы данных и совместимый код из open-source, но только легально и проверяемо. «Взять с GitHub» означает: проверить лицензию, exact commit, конкретные файлы, пригодность и security; затем либо корректно переиспользовать с attribution, либо сделать clean-room реализацию по официальной документации.

Перед изменениями отправь параллельным research-агентам следующие направления:

1. **Codebase mapper** — проследить текущие data flows Home/Optimize/Drivers/Apps от React Query до Rust provider; перечислить реальные пробелы, дубли, mock-only ветки и места рассинхронизации DTO.
2. **Windows API researcher** — выбрать устойчивые API для hardware/system inventory, installed Win32 apps, Appx, package updates и drivers. Приоритет: Microsoft Learn, Win32/WinRT/COM/SetupAPI/Configuration Manager APIs. Отдельно отметить OS/build/elevation ограничения и latency.
3. **OSS + license researcher** — изучить актуальные commits и лицензии подходящих проектов. Начать с уже известных `ChrisTitusTech/winutil`, `Raphire/Win11Debloat`, `farag2/Sophia-Script-for-Windows`, `jonax1337/Reclaim`, `Noktomezo/Winsentials`, затем оценить `marticliment/UniGetUI`, `Klocman/Bulk-Crap-Uninstaller` и другие релевантные проекты. GPL/AGPL/неясная лицензия — только как product-level reference, без переноса кода или текстов. Не считать GitHub-проект источником истины для Windows policy.
4. **UX state researcher** — сопоставить реальные backend states с существующими экранами: initial/loading/refreshing/stale/partial/empty/unsupported/permission-required/offline/error/success/reboot-required. Предложить минимальные изменения текущего UI.

Исследование должно создать/обновить:

- `research/FUNCTIONALITY_AUDIT.md` — что уже реально работает, что mock/hardcode, что сломано или недоказано;
- `research/SOURCE_LEDGER.md` — repo URL, exact commit SHA, license/SPDX, просмотренные файлы, что именно разрешено переиспользовать, normative Microsoft links;
- `research/IMPLEMENTATION_PLAN.md` — короткий dependency-aware план вертикальных срезов;
- `research/PORTING_MATRIX.md` — дополнять по факту реализованного, не стирая существующую историю.

Не клонируй проекты целиком в рабочий репозиторий. Исследовательские checkout/cache держи вне workspace или удаляй только из заранее проверенной временной директории. Не копируй огромные каталоги приложений/твиков без нормализации, deduplication и проверки источников.

После параллельного исследования координатор обязан сам сделать synthesis: сравнить варианты, выбрать минимально рискованный путь, зафиксировать решения и только потом делегировать запись кода. Два агента не должны одновременно править один набор файлов.

## Требуемая продуктовая модель

### 1. Home — реальные и честные данные

Расширь typed system summary так, чтобы экран мог показать полезную live-информацию:

- Windows edition/version/build/architecture, имя устройства и производитель/model, режим elevation;
- CPU model/logical cores, total RAM;
- GPU adapters;
- системные volumes: total/free space и low-space indication;
- uptime/last boot (если надёжно доступно);
- pending restart + причины;
- число найденных driver updates и partial error поиска;
- число установленных приложений, число доступных package updates и статусы providers;
- состояние tweaks/recovery уже существует — переиспользуй его.

Сбор дорогих данных не должен блокировать UI thread. Раздели быстрый summary и более медленные inventory queries, если это уменьшает latency/связность. Показывай last refreshed и частичные ошибки по секциям; падение одного provider не должно обнулять всю главную.

Удали или переименуй фальшивый «System Health / Optimization Score». Предпочтительный default — **Readiness/System overview** с прозрачными счётчиками: pending actions, restart, low disk, unsigned/problem drivers, updates. Если оставляешь числовой score, формула должна быть понятна пользователю, покрыта unit tests и не считать любое включение твика автоматически «здоровьем».

### 2. Optimize — catalog-driven tweaks без доменного hardcode в UI

Сделай расширение твиков удобным для разработчика через data-driven catalog, а не через ручные правки React/Rust match на каждый новый пункт:

- versioned schema + validation с уникальными ID;
- localized title/description/warnings;
- category/tags/goals, risk и rationale;
- Windows versions/min-max builds/architecture/edition applicability;
- admin requirement, affected paths, detection, desired enabled/disabled states;
- restart/logoff/Explorer restart requirement;
- Microsoft references, provenance и last-reviewed metadata;
- точный restore strategy и признак reversibility.

Добавь JSON Schema или эквивалентную строгую проверку каталога в tests/CI. В UI пользователь выбирает только reviewed definitions; **не делай UI для произвольного ввода registry/script**, даже если каталог удобно редактируется разработчиком.

Расширяй каталог постепенно качественными твиками, а не числом ради числа. Кандидаты должны пройти documentation/build/reversibility review. Начни с безопасных user-level Explorer/taskbar/privacy/input/developer settings. Для каждого нового твика нужны detect → plan → apply → postcondition → exact restore tests и ссылки на нормативную документацию. Сомнительные или необратимые кандидаты фиксируй как deferred.

UX Optimize должен показывать live/current/pending state раздельно, mixed/unsupported/managed-by-policy/admin-required, exact changes preview, warnings, restart impact, source links, apply progress, partial failure и recovery entry. Фильтры и категории строятся из каталога, не из switch-списка в компоненте.

### 3. Drivers — реальные драйверы, но без опасного «driver booster»

Сохрани Windows Update Agent как доверенный источник доступных driver updates и проверь текущую реализацию на реальном Windows. Улучши модель:

- устойчивый stable identity и deduplication устройств;
- device class/provider/manufacturer/version/date/INF/signer/signed status;
- loading/searching/partial search error и offline/WSUS/policy cases;
- size, EULA, downloaded, install result, reboot required;
- cancellable/progress task model для долгих download/install вместо блокирующего invoke, если измерения подтверждают проблему;
- refresh/invalidation после операции;
- понятное различие «установленные драйверы» и «доступные обновления».

Проверь, можно ли надёжно получить более качественный inventory через SetupAPI/Configuration Manager или официальный crate/API. Не заменяй рабочий CIM подход сложным FFI без доказанной пользы. Установка должна идти только по identity из результата свежего backend search; повторно валидируй update перед install.

Не обещай rollback драйвера, пока exact recovery не доказан. Перед необратимой/рискованной установкой явно сообщай, что это Windows Update operation, показывай reboot impact и рекомендуй restore point только если он действительно создан и проверен кодом.

### 4. Apps — Installed + App Store + providers

Введи typed объединённую модель, не смешивая статический catalog с состоянием устройства. Нужны как минимум:

- `InstalledApp`/эквивалент: stable normalized identity, display name, version, publisher, install location/date если доступны, source (`registry`, `appx`, `winget`, `choco`), scope, package IDs;
- `CatalogPackage`: provider IDs, metadata/provenance, availability;
- derived state: installed/not installed, installed version, available version, update available, provider unavailable, unknown/unmatched;
- ambiguity-safe matching: exact provider/package IDs в приоритете; name fuzzy matching не должен автоматически разрешать mutation.

Инвентаризация должна объединять:

- Win32 uninstall entries из HKLM/HKCU и 32/64-bit views;
- Appx через уже существующий native WinRT `PackageManager`;
- `winget list`/`winget upgrade` structured output, если версия Winget поддерживает стабильный JSON;
- Chocolatey local/outdated только когда provider доступен.

Нормализуй, deduplicate и сохрани provenance каждой записи. Не показывай system components как обычные uninstallable apps. Поиск/фильтры/сортировка должны работать над backend-derived data.

Раздел Apps UI:

- **Installed** — реальные приложения устройства, sources, versions, update state; сначала read-only inventory и safe update flow;
- **App Store** — каталог и provider availability, install state, install/update action, batch progress;
- provider selector — Winget и Chocolatey сейчас; расширяемый provider interface для Scoop/других только после отдельного исследования, не добавлять фиктивные providers;
- Chocolatey bootstrap остаётся отдельным explicit acknowledged flow; не запускать его неявно;
- uninstall не делать, пока safety/restore/confirmation model не определена. Лучше честно показать «not available yet», чем вызвать raw uninstall string из registry.

App Store может сочетать curated/reviewed catalog для featured apps и live provider search. Не тащи весь интернет-каталог в git. Для live search добавь throttling/cancellation/cache, чётко указывай источник результата и не доверяй remote description как безопасному HTML.

## Архитектурные требования

Используй provider boundaries вместо одного гигантского command handler:

- read-only inventory providers отдельно от mutation runners;
- нормализованные domain DTO отдельно от raw API/CLI output;
- per-provider errors и capabilities;
- bounded concurrency/timeouts/cancellation для медленных операций;
- TanStack Query keys и invalidation по доменам;
- production Tauri и browser preview явно разделены;
- fixtures находятся в test/preview scope и названы fixtures, а не выглядят как live system data.

Сначала добавляй контракт и provider tests, затем IPC, затем UI вертикального среза. Не делай массовый frontend rewrite до появления реальных DTO.

## Порядок реализации

После research+synthesis двигайся небольшими проверяемыми вертикальными срезами:

1. **Baseline** — зафиксировать текущие flows, запустить доступные проверки, отметить уже существующие failures без исправления несвязанных проблем.
2. **System summary/Home** — typed DTO → provider → IPC → query → честный Home UI + unit tests.
3. **Installed Apps** — registry/Appx/manager inventory → normalization/dedup → IPC → Installed UI.
4. **App update/store states** — сопоставление catalog/provider/device → install/update progress и refresh.
5. **Drivers hardening** — async progress/cancellation/partial errors/elevation/reboot UX с реальной Windows проверкой.
6. **Tweak catalog** — schema/provenance tooling, устранение UI category hardcode, затем небольшая проверенная партия новых reversible tweaks.
7. **Cross-cutting UX** — i18n, accessibility, stale/partial/error/unsupported states, query invalidation.
8. **Final verification** — automated suites + реальный Tauri smoke test на Windows + docs/provenance.

Если конкретный срез слишком велик, уменьши его объём, но доведи его end-to-end. Не оставляй одновременно пять наполовину подключённых backend API.

## Проверка и доказательства

После каждого среза запускай релевантный минимум; перед финалом — полный набор:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build

Set-Location src-tauri
cargo fmt --all -- --check
cargo check --all-targets --locked
cargo clippy --all-targets --locked -- -D warnings
cargo test --all-targets --locked
```

Для Windows-specific функционала automated mocks недостаточны. Выполни `pnpm tauri dev`/подходящий smoke build на Windows и собери redacted evidence:

- Home отображает значения этого ПК и переживает partial provider failure;
- Installed Apps содержит реальные Win32 + Appx записи без явных дублей;
- Winget/Chocolatey capability detection честный;
- Drivers показывает реальный inventory и результат поиска обновлений; install не запускай в smoke test без явного согласия пользователя;
- Optimize statuses соответствуют registry до/после тестового low-risk per-user tweak, а restore возвращает точный pre-state;
- browser preview явно помечен и не выдаёт fixtures за результаты сканирования.

Не выполняй реальные install/update/tweak mutations только ради теста без отдельного безопасного подтверждения. Для mutation paths используй unit/integration tests и dry-run/plan; реальный smoke mutation — только минимальный обратимый per-user tweak после согласия.

## Definition of Done

Задача считается завершённой, когда:

- Home больше не выдаёт долю включённых твиков за «здоровье», показывает полезные live system/device/provider aggregates и корректные partial states;
- Optimize полностью питается backend catalog/status, каталог валидируется, категории/filters не зашиты в React, а добавленные твики имеют provenance и exact restore tests;
- Drivers показывает реальные installed/update данные, корректно обрабатывает отсутствие обновлений, ошибки поиска, progress/result/reboot;
- Apps имеет отдельные Installed и App Store представления, реальные device inventory и provider-derived installed/update states;
- production flow не использует mock data, remote scripts или arbitrary commands;
- DTO синхронизированы, i18n и accessibility закрыты для изменённых экранов;
- все релевантные проверки зелёные либо каждый внешний/pre-existing failure честно задокументирован с доказательством;
- `research/*`, README/architecture notes и porting matrix отражают фактическую реализацию и лицензии;
- итоговый отчёт перечисляет изменённые файлы, принятые решения, выполненные команды, Windows smoke evidence, оставшиеся риски и безопасный следующий шаг.

## Формат работы координатора

В начале покажи краткую таблицу агентов: задача, scope, статус. После research выдай мне компактный synthesis: что уже есть, какие API/OSS выбраны, что отклонено и почему, порядок вертикальных срезов. Затем продолжай реализацию, регулярно обновляя статусы без потока сырых логов.

Финальный ответ должен быть проверяемым: не «готово», а конкретные результаты, тесты и ограничения. Если часть цели действительно нельзя завершить, докажи блокер, оставь проект в рабочем состоянии и укажи точный следующий шаг — но не называй research-only результат завершённой реализацией.
