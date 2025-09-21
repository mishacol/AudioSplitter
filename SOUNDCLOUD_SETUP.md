# SoundCloud API Setup

## Получение Client ID

Для работы с SoundCloud API необходимо получить Client ID:

1. **Перейдите на [SoundCloud Developers](https://developers.soundcloud.com/)**
2. **Создайте приложение:**
   - Нажмите "Create an app"
   - Заполните форму:
     - **App name**: Audio Splitter
     - **Description**: Audio splitting tool
     - **Website**: http://localhost:8080 (или ваш домен)
   - Примите условия использования
3. **Получите Client ID:**
   - После создания приложения вы увидите Client ID
   - Скопируйте его

## Настройка в проекте

1. **Откройте файл `src/services/soundcloudService.ts`**
2. **Замените `YOUR_SOUNDCLOUD_CLIENT_ID` на ваш Client ID:**

```typescript
private static readonly SOUNDCLOUD_CLIENT_ID = 'ваш_client_id_здесь';
```

## Возможности SoundCloud API

### ✅ Что работает:
- **Извлечение метаданных трека** (название, автор, длительность)
- **Получение waveform данных** (готовые амплитуды)
- **Прямые ссылки на аудио** (stream_url)
- **Обложки треков** (artwork_url)

### 🎵 Преимущества:
- **Быстрая загрузка** - waveform данные уже готовы
- **Высокое качество** - оригинальные данные от SoundCloud
- **Стабильность** - официальный API
- **Метаданные** - полная информация о треке

### 📝 Примеры URL:
```
https://soundcloud.com/user/track-name
https://soundcloud.com/user/track-name/sets/playlist-name
https://soundcloud.com/track-name
```

## Тестирование

После настройки Client ID:

1. **Запустите приложение**
2. **Введите SoundCloud URL**
3. **Проверьте консоль** - должны появиться логи:
   ```
   🎵 Detected SoundCloud URL, using SoundCloud API...
   ✅ SoundCloud waveform loaded: { trackTitle: "...", duration: 123, waveformPoints: 1000 }
   ```

## Troubleshooting

### Ошибка "Invalid Client ID"
- Проверьте правильность Client ID
- Убедитесь что приложение создано и активно

### Ошибка "Track not found"
- Проверьте правильность URL
- Убедитесь что трек публичный

### Ошибка "Waveform not loading"
- Проверьте CORS настройки
- Убедитесь что трек имеет waveform данные

## Альтернатива

Если SoundCloud API не работает, приложение автоматически переключится на:
- **Python backend** для извлечения метаданных
- **Wavesurfer.js** для генерации waveform
- **Node.js proxy** для стриминга
