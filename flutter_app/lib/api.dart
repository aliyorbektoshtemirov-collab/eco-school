import 'dart:async';
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

  /// Sessiya tugagan yoki token yaroqsiz.
  bool get expired => status == 401 && code == 'unauthenticated';

  /// Internet yoki server bilan bog'liq, qaytadan urinib ko'rish mumkin.
  bool get offline => status == 0;

  @override
  String toString() => message;
}

/// Har qanday xatoni ekranga chiqsa bo'ladigan matnga aylantiradi.
///
/// Ekranlarda `catch (e)` deb ushlanadi: kutilmagan xato chiqsa ham
/// yuklanish aylanasi qotib qolmasligi kerak.
String errorText(Object error) {
  if (error is ApiException) return error.message;
  return 'Nimadir xato ketdi. Qaytadan urinib ko‘ring.';
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

  /// Sessiya tugaganda chaqiriladi — ilova kirish ekraniga qaytadi.
  /// `main.dart` da Session ga ulanadi.
  void Function()? onExpired;

  Future<void> loadToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString(_tokenKey);
    } catch (_) {
      _token = null;
    }
  }

  Future<void> saveToken(String? value) async {
    _token = value;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (value == null) {
        await prefs.remove(_tokenKey);
      } else {
        await prefs.setString(_tokenKey, value);
      }
    } catch (_) {
      // Xotiraga yozib bo'lmasa ham joriy sessiya ishlayveradi.
    }
  }

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{
      'X-Eco-Client': 'mobile',
      'Accept': 'application/json',
    };
    if (json) headers['Content-Type'] = 'application/json';
    if (_token != null) headers['Authorization'] = 'Bearer $_token';
    return headers;
  }

  Uri _uri(String path) => Uri.parse('$baseUrl/api$path');

  /// Hamma so'rov shu yerdan o'tadi: tarmoq xatolari tushunarli
  /// xabarga aylantiriladi va hech qachon ushlanmay qolmaydi.
  Future<Map<String, dynamic>> _run(Future<http.Response> Function() send) async {
    try {
      return _decode(await send());
    } on TimeoutException {
      throw ApiException(0, 'Server javob bermadi. Aloqani tekshirib, qayta urining.');
    } on SocketException {
      throw ApiException(0, 'Internet aloqasi yo‘q.');
    } on HandshakeException {
      throw ApiException(0, 'Xavfsiz ulanish o‘rnatilmadi. Telefon sanasi to‘g‘riligini tekshiring.');
    } on http.ClientException {
      throw ApiException(0, 'Serverga ulanib bo‘lmadi. Qayta urining.');
    } on IOException {
      throw ApiException(0, 'Aloqa uzildi. Qayta urining.');
    }
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      final parsed = jsonDecode(utf8.decode(res.bodyBytes));
      body = parsed is Map<String, dynamic> ? parsed : <String, dynamic>{};
    } catch (_) {
      body = <String, dynamic>{};
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    final message = body['error'] is String
        ? body['error'] as String
        : _statusText(res.statusCode);

    final error = ApiException(res.statusCode, message, body['code'] as String?);

    // Token eskirgan bo'lsa kirish ekraniga qaytamiz. Parol almashtirishdagi
    // "joriy parol noto'g'ri" ham 401 qaytaradi — u `code` siz keladi,
    // shuning uchun bu yerda chiqib ketmaymiz.
    if (error.expired && _token != null) onExpired?.call();

    throw error;
  }

  String _statusText(int status) {
    if (status == 413) return 'Fayl juda katta.';
    if (status == 429) return 'Juda ko‘p urinish bo‘ldi. Biroz kutib turing.';
    if (status >= 500) return 'Serverda nosozlik. Birozdan so‘ng qayta urining.';
    return 'Xatolik yuz berdi ($status).';
  }

  Future<Map<String, dynamic>> get(String path) {
    return _run(() => http
        .get(_uri(path), headers: _headers(json: false))
        .timeout(const Duration(seconds: 25)));
  }

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) {
    return _run(() => http
        .post(_uri(path), headers: _headers(), body: jsonEncode(body ?? const {}))
        .timeout(const Duration(seconds: 30)));
  }

  Future<Map<String, dynamic>> put(String path, [Map<String, dynamic>? body]) {
    return _run(() => http
        .put(_uri(path), headers: _headers(), body: jsonEncode(body ?? const {}))
        .timeout(const Duration(seconds: 30)));
  }

  Future<Map<String, dynamic>> delete(String path) {
    return _run(() => http
        .delete(_uri(path), headers: _headers(json: false))
        .timeout(const Duration(seconds: 25)));
  }

  /// Rasm yuklash: fayl baytlari to'g'ridan-to'g'ri yuboriladi,
  /// javobda R2 kaliti qaytadi.
  Future<String> uploadImage(File file) async {
    List<int> bytes;
    try {
      bytes = await file.readAsBytes();
    } catch (_) {
      throw ApiException(0, 'Rasmni o‘qib bo‘lmadi. Boshqasini tanlang.');
    }

    final headers = <String, String>{
      'X-Eco-Client': 'mobile',
      'Accept': 'application/json',
      'Content-Type': 'application/octet-stream',
    };
    if (_token != null) headers['Authorization'] = 'Bearer $_token';

    final body = await _run(() => http
        .post(_uri('/uploads'), headers: headers, body: bytes)
        .timeout(const Duration(seconds: 90)));

    final key = body['key'];
    if (key is! String || key.isEmpty) {
      throw ApiException(0, 'Rasm yuklanmadi. Qayta urining.');
    }
    return key;
  }

  /// Yuklangan rasmni ko'rsatish uchun manzil.
  String fileUrl(String key, {bool admin = false}) {
    final prefix = admin ? '/api/admin/files/' : '/api/files/';
    return '$baseUrl$prefix$key';
  }

  Map<String, String> get imageHeaders =>
      _token == null ? const {} : {'Authorization': 'Bearer $_token'};
}
