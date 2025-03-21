/**
 * FinTrack Notification System
 * 
 * Usage:
 *  Notify.success("Title", "Message"); // success message (green)
 *  Notify.error("Title", "Message");   // error message (red)
 *  Notify.info("Title", "Message");    // info message (blue)
 *  Notify.warning("Title", "Message"); // warning message (orange)
 */

const Notify = {
    // Show a success notification
    success: function(title, message, duration = 5000) {
        return this._showNotification(title, message, "success", duration);
    },
    
    // Show an error notification
    error: function(title, message, duration = 5000) {
        return this._showNotification(title, message, "error", duration);
    },
    
    // Show an info notification
    info: function(title, message, duration = 5000) {
        return this._showNotification(title, message, "info", duration);
    },
    
    // Show a warning notification
    warning: function(title, message, duration = 5000) {
        return this._showNotification(title, message, "warning", duration);
    },
    
    // Internal method to create and show a notification
    _showNotification: function(title, message, type, duration) {
        // Create notification element
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        
        // Add notification content
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Show with animation (small delay to allow DOM to update)
        setTimeout(() => {
            notification.classList.add("show");
        }, 10);
        
        // Add click to dismiss
        notification.addEventListener("click", () => {
            this._removeNotification(notification);
        });
        
        // Auto-remove after duration
        const timeoutId = setTimeout(() => {
            this._removeNotification(notification);
        }, duration);
        
        // Store timeout ID to allow for manual removal
        notification.dataset.timeoutId = timeoutId;
        
        return notification;
    },
    
    // Remove a notification with animation
    _removeNotification: function(notification) {
        // Clear the timeout if it exists
        if (notification.dataset.timeoutId) {
            clearTimeout(parseInt(notification.dataset.timeoutId));
        }
        
        // Remove show class to trigger fade out animation
        notification.classList.remove("show");
        
        // Remove from DOM after animation completes
        setTimeout(() => {
            notification.remove();
        }, 300);
    }
};