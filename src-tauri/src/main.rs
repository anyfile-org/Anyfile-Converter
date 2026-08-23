// AnyFile Convert — Tauri application entry point
// This file is intentionally minimal. All logic lives in lib.rs.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anyfile_convert_lib::run();
}
