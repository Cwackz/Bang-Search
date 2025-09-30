import SafariServices
import OSLog

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem else {
            NSLog("No input items in extension request")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        let message = item.userInfo?[SFExtensionMessageKey]
        
        NSLog("Received message from content script: \(String(describing: message))")
        
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["response": "Message received"]]
        
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    // Handle storage operations
    func handleStorageRequest(_ request: [String: Any], context: NSExtensionContext) {
        guard let action = request["action"] as? String else { return }
        
        let defaults = UserDefaults(suiteName: "group.com.yourname.bangsearch")
        
        switch action {
        case "getShortcuts":
            let shortcuts = defaults?.dictionary(forKey: "customShortcuts") ?? [:]
            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: ["shortcuts": shortcuts]]
            context.completeRequest(returningItems: [response], completionHandler: nil)
            
        case "setShortcuts":
            if let shortcuts = request["shortcuts"] as? [String: String] {
                defaults?.set(shortcuts, forKey: "customShortcuts")
                let response = NSExtensionItem()
                response.userInfo = [SFExtensionMessageKey: ["success": true]]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            }
            
        default:
            break
        }
    }
}
