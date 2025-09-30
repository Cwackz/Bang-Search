import Cocoa
import SafariServices

class ViewController: NSViewController {

    @IBOutlet var appNameLabel: NSTextField!
    @IBOutlet var shortcutsTableView: NSTableView!
    @IBOutlet var addShortcutButton: NSButton!
    
    private var shortcuts: [String: String] = [:]
    private let defaults = UserDefaults(suiteName: "group.com.yourname.bangsearch")
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        loadShortcuts()
        setupTableView()
    }
    
    private func setupUI() {
        appNameLabel.stringValue = "Bang Search"
        
        // Style the UI for macOS
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
    }
    
    private func setupTableView() {
        shortcutsTableView.delegate = self
        shortcutsTableView.dataSource = self
        
        // Create columns
        let shortcutColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("shortcut"))
        shortcutColumn.title = "Shortcut"
        shortcutColumn.width = 100
        
        let urlColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("url"))
        urlColumn.title = "Search URL"
        urlColumn.width = 300
        
        shortcutsTableView.addTableColumn(shortcutColumn)
        shortcutsTableView.addTableColumn(urlColumn)
    }
    
    private func loadShortcuts() {
        shortcuts = defaults?.dictionary(forKey: "customShortcuts") as? [String: String] ?? [:]
        shortcutsTableView.reloadData()
    }
    
    private func saveShortcuts() {
        defaults?.set(shortcuts, forKey: "customShortcuts")
    }
    
    @IBAction func openSafariExtensionPreferences(_ sender: AnyObject?) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.yourname.bangsearch.Extension") { error in
            if let _ = error {
                // Fallback to opening Safari preferences
                DispatchQueue.main.async {
                    NSWorkspace.shared.open(URL(string: "x-web-search://")!)
                }
            }
        }
    }
    
    @IBAction func addShortcut(_ sender: Any) {
        let alert = NSAlert()
        alert.messageText = "Add Custom Search Shortcut"
        alert.informativeText = "Enter a shortcut (starting with !) and the search URL"
        
        let shortcutField = NSTextField(frame: NSRect(x: 0, y: 28, width: 200, height: 24))
        shortcutField.placeholderString = "!example"
        
        let urlField = NSTextField(frame: NSRect(x: 0, y: 0, width: 200, height: 24))
        urlField.placeholderString = "https://example.com/search?q="
        
        let stackView = NSStackView(frame: NSRect(x: 0, y: 0, width: 200, height: 56))
        stackView.orientation = .vertical
        stackView.spacing = 4
        stackView.addArrangedSubview(shortcutField)
        stackView.addArrangedSubview(urlField)
        
        alert.accessoryView = stackView
        alert.addButton(withTitle: "Add")
        alert.addButton(withTitle: "Cancel")
        
        let response = alert.runModal()
        if response == .alertFirstButtonReturn {
            var shortcut = shortcutField.stringValue.trimmingCharacters(in: .whitespaces)
            let url = urlField.stringValue.trimmingCharacters(in: .whitespaces)
            
            if !shortcut.isEmpty && !url.isEmpty {
                if !shortcut.hasPrefix("!") {
                    shortcut = "!" + shortcut
                }
                
                shortcuts[shortcut] = url
                saveShortcuts()
                shortcutsTableView.reloadData()
            }
        }
    }
    
    private func removeShortcut(at row: Int) {
        let shortcutKeys = Array(shortcuts.keys).sorted()
        if row < shortcutKeys.count {
            let shortcut = shortcutKeys[row]
            shortcuts.removeValue(forKey: shortcut)
            saveShortcuts()
            shortcutsTableView.reloadData()
        }
    }
}

extension ViewController: NSTableViewDataSource, NSTableViewDelegate {
    func numberOfRows(in tableView: NSTableView) -> Int {
        return shortcuts.keys.count
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let shortcutKeys = Array(shortcuts.keys).sorted()
        guard row < shortcutKeys.count else { return nil }

        let shortcut = shortcutKeys[row]
        let url = shortcuts[shortcut] ?? ""

        let identifier = NSUserInterfaceItemIdentifier("Cell_" + (tableColumn?.identifier.rawValue ?? ""))
        let textField: NSTextField

        if let existing = tableView.makeView(withIdentifier: identifier, owner: self) as? NSTextField {
            textField = existing
        } else {
            textField = NSTextField(labelWithString: "")
            textField.identifier = identifier
            textField.lineBreakMode = .byTruncatingMiddle
        }

        if tableColumn?.identifier.rawValue == "shortcut" {
            textField.stringValue = shortcut
        } else {
            textField.stringValue = url
        }

        return textField
    }

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        return 24
    }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 51 { // delete key
            let row = shortcutsTableView.selectedRow
            if row >= 0 { removeShortcut(at: row) }
        } else {
            super.keyDown(with: event)
        }
    }
}