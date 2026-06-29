use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;

                let updater = match handle.updater() {
                    Ok(u) => u,
                    Err(e) => {
                        eprintln!("[updater] 初始化失败: {}", e);
                        return;
                    }
                };

                match updater.check().await {
                    Ok(Some(update)) => {
                        eprintln!("[updater] 发现新版本: {}", update.version);
                        match update.download_and_install(|_chunk, _total| {}, || {}).await {
                            Ok(_) => eprintln!("[updater] 更新下载完成，重启生效"),
                            Err(e) => eprintln!("[updater] 下载失败: {}", e),
                        }
                    }
                    Ok(None) => {
                        eprintln!("[updater] 已是最新版本");
                    }
                    Err(e) => {
                        eprintln!("[updater] 检查失败: {}", e);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
