//! Utility functions

#[cfg(feature = "full-system")]
use sysinfo::System;

/// Get current memory usage in bytes
pub fn get_memory_usage() -> u64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(contents) = std::fs::read_to_string("/proc/self/status") {
            for line in contents.lines() {
                if line.starts_with("VmRSS:") {
                    if let Some(kb_str) = line.split_whitespace().nth(1) {
                        if let Ok(kb) = kb_str.parse::<u64>() {
                            return kb * 1024; // Convert to bytes
                        }
                    }
                }
            }
        }
    }

    #[cfg(all(target_os = "macos", feature = "libc"))]
    {
        use libc::{c_void, getpid, proc_pidinfo, PROC_PIDTASKINFO};
        use std::mem;

        #[repr(C)]
        struct ProcTaskInfo {
            pti_virtual_size: u64,
            pti_resident_size: u64,
            pti_total_user: u64,
            pti_total_system: u64,
            pti_threads_user: u64,
            pti_threads_system: u64,
            pti_policy: i32,
            pti_faults: i32,
            pti_pageins: i32,
            pti_cow_faults: i32,
            pti_messages_sent: i32,
            pti_messages_received: i32,
            pti_syscalls_mach: i32,
            pti_syscalls_unix: i32,
            pti_csw: i32,
            pti_threadnum: i32,
            pti_numrunning: i32,
            pti_priority: i32,
        }

        let pid = unsafe { getpid() };
        let mut task_info = mem::MaybeUninit::<ProcTaskInfo>::uninit();

        let result = unsafe {
            proc_pidinfo(
                pid,
                PROC_PIDTASKINFO,
                0,
                task_info.as_mut_ptr() as *mut c_void,
                mem::size_of::<ProcTaskInfo>() as i32,
            )
        };

        if result > 0 {
            let task_info = unsafe { task_info.assume_init() };
            return task_info.pti_resident_size;
        }
    }

    #[cfg(feature = "full-system")]
    {
        // Fallback: use sysinfo crate
        let mut system = System::new_all();
        system.refresh_memory();
        let pid = sysinfo::get_current_pid().unwrap();
        system
            .process(pid)
            .map(|process| {
                process.memory() * 1024 // sysinfo returns KB, convert to bytes
            })
            .unwrap_or(0)
    }
    #[cfg(not(feature = "full-system"))]
    {
        // WASM fallback - return 0 as memory info isn't available
        0u64
    }
}

/// Detect programming language from file path
pub fn detect_language_from_path(
    file_path: &str,
) -> Result<String, crate::error::ASTProcessingError> {
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");

    let language = match extension {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "py" | "pyi" | "pyw" => "python",
        "rs" => "rust",
        "java" => "java",
        "cpp" | "cc" | "cxx" | "c++" | "hpp" | "hh" | "hxx" | "h++" => "cpp",
        "c" | "h" => "c",
        "cs" => "c_sharp",
        "go" => "go",
        "rb" => "ruby",
        "php" => "php",
        "kt" => "kotlin",
        "swift" => "swift",
        "scala" => "scala",
        "sh" | "bash" => "bash",
        _ => {
            return Err(crate::error::ASTProcessingError::UnsupportedLanguage(
                format!("No language mapping found for extension: {}", extension),
            ))
        }
    };

    Ok(language.to_string())
}

/// Format bytes as human readable string
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    format!("{:.2} {}", size, UNITS[unit_idx])
}

/// Calculate similarity score between two vectors (cosine similarity)
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot_product / (norm_a * norm_b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_language_from_path() {
        assert_eq!(detect_language_from_path("test.ts").unwrap(), "typescript");
        assert_eq!(detect_language_from_path("test.js").unwrap(), "javascript");
        assert_eq!(detect_language_from_path("test.py").unwrap(), "python");
        assert_eq!(detect_language_from_path("test.rs").unwrap(), "rust");
        assert!(detect_language_from_path("test.unknown").is_err());
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![1.0, 2.0, 3.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);

        let c = vec![1.0, 0.0, 0.0];
        let d = vec![0.0, 1.0, 0.0];
        assert!((cosine_similarity(&c, &d) - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1024 * 1024), "1.00 MB");
        assert_eq!(format_bytes(512), "512.00 B");
    }
}
