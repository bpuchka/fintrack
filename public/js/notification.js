/**
 * FinTrack Notification System
 * 
 * Usage:
 *  showNotification("Title", "Message", "success"); // success, error, info, warning
 *  showNotification("Error", "Something went wrong", "error", 8000); // custom duration
 *  
 * Types: success (green), error (red), info (blue), warning (orange)
 */

function showNotification(title, message, type = "info", duration = 5000) {
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
        removeNotification(notification);
    });
    
    // Auto-remove after duration
    const timeoutId = setTimeout(() => {
        removeNotification(notification);
    }, duration);
    
    // Store timeout ID to allow for manual removal
    notification.dataset.timeoutId = timeoutId;
    
    return notification;
}

function removeNotification(notification) {
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

// Shorthand helper methods
const Notify = {
    success: (title, message, duration) => showNotification(title, message, "success", duration),
    error: (title, message, duration) => showNotification(title, message, "error", duration),
    info: (title, message, duration) => showNotification(title, message, "info", duration),
    warning: (title, message, duration) => showNotification(title, message, "warning", duration)
};