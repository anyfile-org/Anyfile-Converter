use std::env;
use winreg::enums::*;
use winreg::RegKey;

/// Registers AnyFile Convert in the Windows Explorer right-click menu for specific file types.
/// Creates a cascading menu natively in the Windows Registry.
pub fn register_context_menu() -> Result<(), Box<dyn std::error::Error>> {
    let exe_path = env::current_exe()?;
    let exe_path_str = exe_path.to_string_lossy().to_string();
    let safe_exe_path = if let Some(stripped) = exe_path_str.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        exe_path_str
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Images
    register_for_extensions(
        &hkcu,
        &[".jpg", ".jpeg", ".png", ".webp", ".bmp"],
        &safe_exe_path,
        &[
            ("cmd1", "Convert to PNG", "image.jpg_to_png"),
            ("cmd2", "Convert to JPG", "image.png_to_jpg"),
            ("cmd3", "Compress Image", "image.compress"),
        ],
    )?;

    // Video
    register_for_extensions(
        &hkcu,
        &[".mp4", ".avi", ".mov", ".mkv", ".webm"],
        &safe_exe_path,
        &[("cmd1", "Extract Audio", "video.extract_audio")],
    )?;

    // PDF
    register_for_extensions(
        &hkcu,
        &[".pdf"],
        &safe_exe_path,
        &[
            ("cmd1", "Merge PDFs", "pdf.merge"),
            ("cmd2", "Split PDF", "pdf.split"),
        ],
    )?;

    // Archives
    register_for_extensions(
        &hkcu,
        &[".zip"],
        &safe_exe_path,
        &[
            ("cmd1", "Extract ZIP", "archive.extract_zip"),
            ("cmd2", "Create ZIP", "archive.create_zip"),
        ],
    )?;

    Ok(())
}

fn register_for_extensions(
    hkcu: &RegKey,
    extensions: &[&str],
    safe_exe_path: &str,
    commands: &[(&str, &str, &str)], // (registry_key_id, display_label, tool_id)
) -> Result<(), Box<dyn std::error::Error>> {
    for ext in extensions {
        let path = format!(
            r"Software\Classes\SystemFileAssociations\{}\shell\AnyFile Convert",
            ext
        );

        // We ignore errors on individual extensions (e.g. permission issues) and just try our best
        if let Ok((shell_key, _)) = hkcu.create_subkey(path) {
            let _ = shell_key.set_value("MUIVerb", &"AnyFile Convert");
            // Setting "SubCommands" to empty string tells Windows to look for a "shell" subkey
            let _ = shell_key.set_value("SubCommands", &"");
            let _ = shell_key.set_value("Icon", &format!("\"{}\",0", safe_exe_path));

            if let Ok((sub_shell, _)) = shell_key.create_subkey("shell") {
                for (cmd_id, label, tool_id) in commands {
                    if let Ok((cmd_key, _)) = sub_shell.create_subkey(cmd_id) {
                        let _ = cmd_key.set_value("MUIVerb", label);
                        if let Ok((command_key, _)) = cmd_key.create_subkey("command") {
                            let command_string = format!(
                                "\"{}\" --file \"%1\" --tool \"{}\"",
                                safe_exe_path, tool_id
                            );
                            let _ = command_key.set_value("", &command_string);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
