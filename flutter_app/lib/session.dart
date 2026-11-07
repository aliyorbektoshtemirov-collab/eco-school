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
      _user = EcoUser(res['user'] as Map<String, dynamic>);
    } catch (_) {
      // Token eskirgan yoki internet yo'q — kirish ekraniga qaytamiz
      await Api.instance.saveToken(null);
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

  Future<void> _accept(Map<String, dynamic> res) async {
    final token = res['token'] as String?;
    if (token != null) await Api.instance.saveToken(token);

    _user = EcoUser(res['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  /// Ball o'zgargach profilni yangilaymiz.
  Future<void> refresh() async {
    try {
      final res = await Api.instance.get('/auth/me');
      _user = EcoUser(res['user'] as Map<String, dynamic>);
      notifyListeners();
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
}
