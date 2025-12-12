// For UMD/script tag support
interface Window {
  WebEyeLogs: {
    Monitor: typeof Monitor
    plugins: {
      ConsolePlugin: typeof ConsolePlugin
      RequestPlugin: typeof RequestPlugin
      ResourcePlugin: typeof ResourcePlugin
      ErrorPlugin: typeof ErrorPlugin
      CustomPlugin: typeof CustomPlugin
      WhiteScreenPlugin: typeof WhiteScreenPlugin
      PerformancePlugin: typeof PerformancePlugin
      RecordPlugin: typeof RecordPlugin
    }
    version: string
  }
}
