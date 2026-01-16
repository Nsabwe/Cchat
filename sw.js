self.addEventListener("push", (event) => {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/icon.png",
        tag: data.tag || "notification",
        renotify: data.renotify || false,
    });
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: "window" }).then((clientList) => {
            if (clientList.length > 0) {
                clientList[0].focus();
            } else {
                clients.openWindow("/");
            }
        })
    );
});