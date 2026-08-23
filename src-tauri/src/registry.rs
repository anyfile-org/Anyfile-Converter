use std::env;
use winreg::enums::*;
use winreg::RegKey;

/// Registers AnyFile Convert in the Windows Explorer right-click menu for all files.
/// Sub-key created: `HKCU\Software\Classes\*\shell\AnyFile Convert`
pub fn register_context_menu() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Get the current executable path
    let exe_path = env::current_exe()?;
    // Winreg sometimes doesn't like UNC paths for shell commands, 
    // but standard canonicalization on Windows might add `\\?\C:\`.
    // For shell integration, `C:\path\to.exe` is safest.
    let exe_path_str = exe_path.to_string_lossy().to_string();
    let safe_exe_path = if exe_path_str.starts_with(r"\\?\") {
        exe_path_str[4..].to_string()
    } else {
        exe_path_str
    };

    // 2. Open HKCU\Software\Classes\*\shell
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Classes\*\shell";
    
    // We try to open or create the base path
    let (shell_key, _) = hkcu.create_subkey(path)?;

    // 3. Create our app's entry
    let (app_key, _) = shell_key.create_subkey("AnyFile Convert")?;
    
    // Set the display name in the context menu
    app_key.set_value("", &"AnyFile Convert")?;
    // Optional: Add an icon (uses the exe's embedded icon)
    app_key.set_value("Icon", &format!("\"{}\",0", safe_exe_path))?;

    // 4. Create the `command` subkey
    let (command_key, _) = app_key.create_subkey("command")?;
    
    // Set the command to execute: `anyfile-convert.exe --file "%1"`
    let command_string = format!("\"{}\" --file \"%1\"", safe_exe_path);
    command_key.set_value("", &command_string)?;

    Ok(())
}
