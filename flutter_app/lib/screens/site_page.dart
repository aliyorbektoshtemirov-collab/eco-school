import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../api.dart';

/// Shared website sections use the same signed-in account as the native app.
class SitePage extends StatefulWidget {
  const SitePage({super.key, required this.path, required this.title});
  final String path;
  final String title;
  @override
  State<SitePage> createState() => _SitePageState();
}
class _SitePageState extends State<SitePage> {
  WebViewController? _controller;
  String? _error;
  @override
  void initState() { super.initState(); _open(); }
  Future<void> _open() async {
    try {
      final origin = Uri.parse(Api.baseUrl);
      final token = Api.instance.token;
      if (token != null) {
        await WebViewCookieManager().setCookie(WebViewCookie(name: 'eco_session', value: token, domain: origin.host, path: '/'));
      }
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(NavigationDelegate(
          onNavigationRequest: (request) => Uri.parse(request.url).host == origin.host ? NavigationDecision.navigate : NavigationDecision.prevent,
        ));
      await controller.loadRequest(Uri.parse('${Api.baseUrl}${widget.path}'));
      if (mounted) setState(() => _controller = controller);
    } catch (_) {
      if (mounted) setState(() => _error = 'Sahifani ochib bo‘lmadi.');
    }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: _error != null ? Center(child: Text(_error!)) : _controller == null
      ? const Center(child: CircularProgressIndicator())
      : WebViewWidget(controller: _controller!),
  );
}
