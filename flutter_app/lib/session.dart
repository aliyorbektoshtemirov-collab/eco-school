import 'package:flutter/foundation.dart';

import 'api.dart';

/// Kirgan foydalanuvchi.
class EcoUser {
  EcoUser(this.raw);

  final Map<String, dynamic> raw;

  int get id => (raw['id'] as num?)?.toInt() ?? 0;
  String get username => raw['username'] as String? ?? '';
  String get fullName => raw['full_name'] as String? ?? '';
  String? get className => raw['class_name'] as String?;
  String get schoolCode => raw['school_code'] as String? ?? '';
  String get role => raw['role'] as String? ?? 'student';
  int get points => (raw['points'] as num?)?.toInt() ?? 0;

  bool get isAdmin => role == 'admin' || role == 'owner';
  bool get isOwner => role == 'owner';

  /// Ism-familiyaning bosh harflari — avatar o'rnida.
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return username.isEmpty ? '?' : username[0].toUpperCase();
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

/// Kirish holati. Ilovaning hamma joyidan shu kuzatiladi.
class Session extends ChangeNotifier {
  Session() {
    // Token eskirsa ilova o'zi kirish ekraniga qaytadi.
    Api.instance.onExpired = _dropSession;
  }

  EcoUser? _user;
  bool _loading = true;

  EcoUser? get user => _user;
  bool get loading => _loading;
  bool get signedIn => _user != null;

  /// Ilova ochilganda: saqlangan token bilan kirishga urinamiz.
  Future<void> restore() async {
    await Api.instance.loadToken();

    if (Api.instance.token == null) {
      _loading = false;
      notifyListeners();
      return;
    }

    try {
      final res = await Api.instance.get('/auth/me');
      final raw = res['user'];

      if (raw is Map<String, dynamic>) {
        _user = EcoUser(raw);
      } else {
        // Server 200 qaytaradi-yu, foydalanuvchi yo'q — token yaroqsiz.
        await Api.instance.saveToken(null);
        _user = null;
      }
    } on ApiException catch (e) {
      // Internet yo'q bo'lsa tokenni saqlab qolamiz — keyin qayta urinamiz.
      // Faqat token haqiqatan yaroqsiz bo'lsagina o'chiramiz.
      if (!e.offline) await Api.instance.saveToken(null);
      _user = null;
    } catch (_) {
      _user = null;
    }

    _loading = false;
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final res = await Api.instance.post('/auth/login', {
      'username': username.trim(),
      'password': password,
    });

    await _accept(res);
  }

  Future<void> register({
    required String username,
    required String password,
    required String fullName,
    required String className,
    required String schoolCode,
  }) async {
    final res = await Api.instance.post('/auth/register', {
      'username': username.trim(),
      'password': password,
      'fullName': fullName.trim(),
      'className': className,
      'schoolCode': schoolCode.trim(),
    });

    await _accept(res);
  }

  EcoUser _read(Map<String, dynamic> res) {
    final raw = res['user'];
    if (raw is! Map<String, dynamic>) {
      throw ApiException(0, 'Server javobi tushunarsiz. Qayta urining.');
    }
    return EcoUser(raw);
  }

  Future<void> _accept(Map<String, dynamic> res) async {
    final user = _read(res);

    final token = res['token'];
    if (token is String && token.isNotEmpty) {
      await Api.instance.saveToken(token);
    } else {
      // Token kelmasa keyingi so'rovlar baribir rad etiladi —
      // sababini shu yerda aytganimiz ma'qul.
      throw ApiException(0, 'Server kirish kalitini bermadi. Ilovani yangilang.');
    }

    _user = user;
    notifyListeners();
  }

  /// Ball o'zgargach profilni yangilaymiz.
  Future<void> refresh() async {
    try {
      final res = await Api.instance.get('/auth/me');
      final raw = res['user'];

      if (raw is Map<String, dynamic>) {
        _user = EcoUser(raw);
        notifyListeners();
      } else {
        _dropSession();
      }
    } catch (_) {
      // jim o'tkazamiz — bu yordamchi yangilash
    }
  }

  Future<void> logout() async {
    try {
      await Api.instance.post('/auth/logout');
    } catch (_) {
      // server javob bermasa ham telefondan chiqamiz
    }
    await Api.instance.saveToken(null);
    _user = null;
    notifyListeners();
  }

  /// Token yaroqsiz bo'lib qolganda — serverga murojaat qilmaymiz.
  void _dropSession() {
    if (_user == null) return;
    Api.instance.saveToken(null);
    _user = null;
    notifyListeners();
  }
}
