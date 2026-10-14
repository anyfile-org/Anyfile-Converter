export type TrackedOperation =
  | 'image.jpg_to_png'
  | 'image.png_to_jpg'
  | 'image.compress'
  | 'image.to_webp'
  | 'image.to_avif'
  | 'image.demo_convert'
  | 'pdf.merge'
  | 'pdf.split'
  | 'video.extract_audio'
  | 'archive.create_zip'
  | 'archive.extract_zip'
  | 'button.download_latest'
  | 'button.github_repo'
  | 'button.view_releases'
  | 'button.web_app_open'
  | 'button.try_demo';

function getClientId() {
  const storageKey = 'anyfile_analytics_client_id';
  try {
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(storageKey, id);
    }
    return id;
  } catch (error) {
    console.warn('Could not persist anonymous analytics ID:', error);
    return crypto.randomUUID();
  }
}

export function trackAnalyticsEvent(
  event: 'button_clicked' | 'operation_completed',
  operation: TrackedOperation
) {
  try {
    if (localStorage.getItem('anyfile_analytics_consent') !== 'yes') return;
  } catch (error) {
    console.warn('Could not read analytics consent:', error);
    return;
  }

  const payload = {
    client_id: getClientId(),
    events: [{
      event_id: crypto.randomUUID(),
      event,
      category: event === 'operation_completed' ? 'tool' : 'app',
      operation,
      platform: 'web',
      app_version: 'website',
      quantity: 1,
      timestamp: Math.floor(Date.now() / 1000),
    }],
  };

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) {
        console.warn(`Could not submit anonymous analytics event (HTTP ${response.status}).`);
      }
    })
    .catch((error: unknown) => {
      console.warn('Could not submit anonymous analytics event:', error);
    });
}
