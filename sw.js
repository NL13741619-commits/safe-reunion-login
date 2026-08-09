self.addEventListener("push", function(event) {
    const data = event.data ? event.data.json() : {};

    event.waitUntil(
        self.registration.showNotification(
            data.title || "安全團聚",
            {
                body: data.body || "你有新的通知",
                icon: "/icon.png"
            }
        )
    );
});
