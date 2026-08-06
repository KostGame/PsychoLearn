# PsychoLearn

Мобильный учебный сайт с короткими конспектами лекций по психологии, карточками и тестами.

Сайт: <https://kostgame.github.io/PsychoLearn/>

Если GitHub Pages временно недоступен, тему 12 можно открыть как автономную страницу:

- [Тема 12 без GitHub Pages](https://raw.githack.com/KostGame/PsychoLearn/main/downloads/theme-12.html)
- [Скачать автономный HTML с GitHub](https://github.com/KostGame/PsychoLearn/raw/main/downloads/theme-12.html)

## Что уже есть

- тема 9 «Безопасность личности в экстремальных ситуациях»;
- тема 11 «Социальная стабильность и психологическая безопасность»;
- тема 12 «Современное общество рисков и психологическая безопасность»;
- режим «Суть за 5 минут»;
- структурированный конспект с поиском и настройкой размера текста;
- сохранение прогресса на устройстве;
- карточки для активного повторения;
- тест с объяснениями;
- светлая и тёмная темы;
- адаптивная вёрстка для телефона.

## Структура

```text
site/
  index.html              оболочка приложения
  styles.css              мобильная и десктопная вёрстка
  app.js                  навигация, прогресс, карточки и тест
  lectures/
    index.js              реестр лекций
    lecture-09.js         содержание темы 9
    lecture-11.js         содержание темы 11
    lecture-12.js         содержание темы 12
  assets/theme-12/        исходные графики темы 12
notes/
  09-safety-in-extreme-situations.md
  11-social-stability-and-psychological-safety.md
  12-risk-society-and-psychological-safety.md
downloads/
  theme-12.html           автономная версия темы 12
scripts/
  build-standalone.mjs    сборка автономной версии лекции
```

## Как добавлять следующие лекции

1. Сохранить новую лекцию отдельным модулем в `site/lectures/` по структуре `lecture-09.js`.
2. Импортировать модуль и добавить его в массив `lectures` в `site/lectures/index.js`.
3. При необходимости положить текстовую версию конспекта в `notes/`.
4. После изменения `main` GitHub Actions автоматически обновит GitHub Pages.
5. Для автономной версии запустить `node scripts/build-standalone.mjs НОМЕР`, например `node scripts/build-standalone.mjs 12`.

Для локального просмотра нужен любой статический HTTP-сервер. Например:

```bash
python3 -m http.server 8000 --directory site
```
