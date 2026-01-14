async function registerPush(userName) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const registration = await navigator.serviceWorker.register("/sw.js");

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
            "YOUR_VAPID_PUBLIC_KEY"
        ),
    });

    await fetch("/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName, subscription }),
    });

    console.log("Push notifications enabled for", userName);
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Example: enable notifications for current user
registerPush("Alice");