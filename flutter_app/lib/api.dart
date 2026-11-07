import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Serverdan kelgan xato — ekranda shu matn ko'rsatiladi.
class ApiException implements Exception {
  ApiException(this.status, this.message, [this.code]);

  final int status;
  final String message;
  final String? code;

  bool get unauthenticated => status == 401;

  @override
  String toString() => message;
}

/// Worker API bilan ishlash.
///
/// Brauzer cookie ishlatadi, ilova esa token: kirishda server tokenni
/// qaytaradi, u telefonda saqlanadi va har so'rovda sarlavhada ketadi.
class Api {
  Api._();

  static final Api instance = Api._();

  /// Yig'ilishda almashtirish mumkin:
  /// flutter build apk --dart-define=ECO_API=https://...
  static const String baseUrl = String.fromEnvironment(
    'ECO_API',
    defaultValue: 'https://eco-school.eco-school.workers.dev',
  );

  static const _tokenKey = 'eco_token';

  String? _token;
  String? get token => _token;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  Future<void> saveToken(String? value) async {
    _token = value;
    final prefs = await SharedPreferences.getInstance();
    if (value == null) {
      await prefs.remove(_tokenKey);
    } else {
      await prefs.setString(_tokenKey, value);
    }
  }

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{'X-Eco-Client': 'mobile'};
    if (json) headers['Content-Type'] = 'application/json';
    if (_token != null) headers['Authorization'] = 'Bearer $_token';
    return headers;
  }

  Uri _uri(String path) => Uri.parse('$baseUrl/api$path');

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      final parsed = jsonDecode(res.body);
      body = parsed is Map<String, dynamic> ? parsed : <String, dynamic>{};
    } catch (_) {
      body = <String, dynamic>{};
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    final message = body['error'] is String
        ? body['error'] as String
        : 'Xatolik yuz berdi (${res.statusCode}).';

    throw ApiException(res.statusCode, message, body['code'] as String?);
  }

  Future<Map<String, dynamic>> get(String path) async {
    try {
      final res = await http
          .get(_uri(path), headers: _headers(json: false))
          .timeout(const Duration(seconds: 25));
      return _decode(res);
    } on SocketException {
      throw ApiException(0, 'Internet aloqasi yo‘q.');
    }
  }

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) async {
    try {
      final res = await http
          .post(_uri(path), headers: _headers(), body: jsonEncode(body ?? const {}))
          .timeout(const Duration(seconds: 25));
      return _decode(res);
    } on SocketException {
      throw ApiException(0, 'Internet aloqasi yo‘q.');
    }
  }

  Future<Map<String, dynamic>> put(String path, [Map<String, dynamic>? body]) async {
    try {
      final res = await http
          .put(_uri(path), headers: _headers(), body: jsonEncode(body ?? const {}))
          .timeout(const Duration(seconds: 25));
      return _decode(res);
    } on SocketException {
      throw ApiException(0, 'Internet aloqasi yo‘q.');
    }
  }

  Future<Map<String, dynamic>> delete(String path) async {
    try {
      final res = await http
          .delete(_uri(path), headers: _headers(json: false))
          .timeout(const Duration(seconds: 25));
      return _decode(res);
    } on SocketException {
      throw ApiException(0, 'Internet aloqasi yo‘q.');
    }
  }

  /// Rasm yuklash: fayl baytlari to'g'ridan-to'g'ri yuboriladi,
  /// javobda R2 kaliti qaytadi.
  Future<String> uploadImage(File file) async {
    final bytes = await file.readAsBytes();

    final headers = <String, String>{
      'X-Eco-Client': 'mobile',
      'Content-Type': 'application/octet-stream',
    };
    if (_token != null) headers['Authorization'] = 'Bearer $_token';

    try {
      final res = await http
          .post(_uri('/uploads'), headers: headers, body: bytes)
          .timeout(const Duration(seconds: 60));
      final body = _decode(res);
      return body['key'] as String;
    } on SocketException {
      throw ApiException(0, 'Internet aloqasi yo‘q.');
    }
  }

  /// Yuklangan rasmni ko'rsatish uchun manzil.
  String fileUrl(String key, {bool admin = false}) {
    final prefix = admin ? '/api/admin/files/' : '/api/files/';
    return '$baseUrl$prefix$key';
  }

  Map<String, String> get imageHeaders =>
      _token == null ? const {} : {'Authorization': 'Bearer $_token'};
}
