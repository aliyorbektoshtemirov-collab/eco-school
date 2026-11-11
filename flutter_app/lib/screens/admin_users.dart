import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// Owner paneli: odamlar, admin tayinlash, parolni tiklash.
/// Server tomoni (`/users...`) faqat owner uchun ochiq.
class UserAdminScreen extends StatelessWidget {
  const UserAdminScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(title: const Text('Odamlar va adminlar')),
      body: const UserAdmin(),
    );
  }
}

class UserAdmin extends StatefulWidget {
  const UserAdmin({super.key});

  @override
  State<UserAdmin> createState() => _UserAdminState();
}

class _UserAdminState extends State<UserAdmin> {
  final _search = TextEditingController();
  List<dynamic> _users = const [];
  Map<String, dynamic> _counts = const {};
  String _role = '';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final q = <String>['limit=200'];
      final text = _search.text.trim();
      if (text.isNotEmpty) q.add('q=${Uri.encodeQueryComponent(text)}');
      if (_role.isNotEmpty) q.add('role=$_role');

      final res = await Api.instance.get('/users?${q.join('&')}');
      if (!mounted) return;
      setState(() {
        _users = (res['users'] as List?) ?? const [];
        _counts = (res['counts'] as Map?)?.cast<String, dynamic>() ?? const {};
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) showNote(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleAdmin(Map<String, dynamic> u) async {
    final makeAdmin = u['role'] != 'admin';
    final name = u['full_name'] as String? ?? '';

    final yes = await confirm(
      context,
      title: makeAdmin ? 'Admin qilasizmi?' : 'Adminlikni olasizmi?',
      body: makeAdmin
          ? '$name tasdiqlash va vazifalarni boshqara oladi.'
          : '$name oddiy o‘quvchiga qaytariladi.',
      yes: makeAdmin ? 'Admin qilish' : 'Olib tashlash',
      danger: !makeAdmin,
    );
    if (!yes) return;

    await _run(() async {
      final res = await Api.instance.post(
        '/users/${u['id']}/role',
        {'role': makeAdmin ? 'admin' : 'student'},
      );
      if (mounted) showNote(context, res['message'] as String? ?? 'Saqlandi.');
      await _load();
    });
  }

  Future<void> _reset(Map<String, dynamic> u) async {
    final yes = await confirm(
      context,
      title: 'Parolni tiklaysizmi?',
      body: '${u['full_name']} uchun yangi vaqtinchalik parol yaratiladi. '
          'Eski parol ishlamaydi.',
      yes: 'Tiklash',
    );
    if (!yes) return;

    await _run(() async {
      final res = await Api.instance.post('/users/${u['id']}/reset-password', {});
      if (!mounted) return;
      await _showCredentials(
        res['username'] as String? ?? '',
        res['password'] as String? ?? '',
      );
    });
  }

  Future<void> _delete(Map<String, dynamic> u) async {
    final yes = await confirm(
      context,
      title: 'O‘chirasizmi?',
      body: '${u['full_name']} hisobi butunlay o‘chadi. Bu ortga qaytmaydi.',
      yes: 'O‘chirish',
      danger: true,
    );
    if (!yes) return;

    await _run(() async {
      final res = await Api.instance.delete('/users/${u['id']}');
      if (mounted) showNote(context, res['message'] as String? ?? 'O‘chirildi.');
      await _load();
    });
  }

  Future<void> _showCredentials(String username, String password) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Eco.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Kirish ma’lumotlari',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Parol faqat hozir ko‘rinadi. Egasiga yuboring, keyin u o‘zgartirsin.',
              style: TextStyle(fontSize: 13.5, height: 1.5, color: Eco.muted),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Eco.greenTint,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Login', style: TextStyle(fontSize: 12, color: Eco.muted)),
                  SelectableText(
                    username,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  const Text('Parol', style: TextStyle(fontSize: 12, color: Eco.muted)),
                  SelectableText(
                    password,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: 'Login: $username\nParol: $password'));
              showNote(ctx, 'Nusxa olindi.');
            },
            child: const Text('Nusxa olish'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tayyor'),
          ),
        ],
      ),
    );
  }

  Future<void> _createAdmin() async {
    final created = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _CreateAdminSheet(),
    );

    if (created == null || !mounted) return;
    await _load();
    if (!mounted) return;
    await _showCredentials(
      created['username'] as String? ?? '',
      created['password'] as String? ?? '',
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: Eco.green,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          _CreateButton(onTap: _createAdmin),
          const SizedBox(height: 14),
          Row(
            children: [
              _Stat(label: 'Hammasi', value: '${_counts['all'] ?? 0}'),
              const SizedBox(width: 10),
              _Stat(label: 'O‘quvchi', value: '${_counts['students'] ?? 0}'),
              const SizedBox(width: 10),
              _Stat(label: 'Admin', value: '${_counts['admins'] ?? 0}'),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _load(),
            decoration: InputDecoration(
              hintText: 'Ism yoki login bo‘yicha qidiring',
              prefixIcon: const Icon(Icons.search, color: Eco.muted),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 19, color: Eco.muted),
                      onPressed: () {
                        _search.clear();
                        _load();
                      },
                    ),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              _chip('Hammasi', ''),
              _chip('O‘quvchilar', 'student'),
              _chip('Adminlar', 'admin'),
            ],
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Loading()
          else if (_error != null)
            ErrorNote(message: _error!, onRetry: _load)
          else if (_users.isEmpty)
            const EmptyNote(
              title: 'Hech kim topilmadi',
              hint: 'Qidiruvni o‘zgartirib ko‘ring.',
              icon: Icons.people_outline,
            )
          else
            ..._users.map((raw) {
              final u = (raw as Map).cast<String, dynamic>();
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _UserCard(
                  user: u,
                  busy: _busy,
                  onToggleAdmin: () => _toggleAdmin(u),
                  onReset: () => _reset(u),
                  onDelete: () => _delete(u),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _chip(String text, String value) {
    final on = _role == value;
    return ChoiceChip(
      label: Text(text),
      selected: on,
      showCheckmark: false,
      selectedColor: Eco.green,
      backgroundColor: Eco.surface,
      side: const BorderSide(color: Eco.rule),
      labelStyle: TextStyle(
        fontWeight: FontWeight.w600,
        color: on ? Colors.white : Eco.ink,
      ),
      onSelected: (_) {
        setState(() => _role = value);
        _load();
      },
    );
  }
}

class _CreateButton extends StatelessWidget {
  const _CreateButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Eco.green,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: const [
            Icon(Icons.person_add_alt_1, color: Colors.white),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Yangi admin qo‘shish',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
            Icon(Icons.add, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Eco.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Eco.rule),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: Eco.green,
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 12, color: Eco.muted)),
          ],
        ),
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({
    required this.user,
    required this.busy,
    required this.onToggleAdmin,
    required this.onReset,
    required this.onDelete,
  });

  final Map<String, dynamic> user;
  final bool busy;
  final VoidCallback onToggleAdmin;
  final VoidCallback onReset;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final role = user['role'] as String? ?? 'student';
    final isOwner = role == 'owner';
    final isAdmin = role == 'admin';
    final name = user['full_name'] as String? ?? '';
    final points = (user['points'] as num?)?.toInt() ?? 0;

    return EcoCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isOwner || isAdmin ? Eco.green : Eco.greenTint,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  name.isEmpty ? '?' : name.trim()[0].toUpperCase(),
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: isOwner || isAdmin ? Colors.white : Eco.green,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        color: Eco.ink,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          '@${user['username']}',
                          style: const TextStyle(fontSize: 12.5, color: Eco.muted),
                        ),
                        ClassTag(name: user['class_name'] as String?),
                      ],
                    ),
                  ],
                ),
              ),
              if (isOwner || isAdmin)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: Eco.greenTint,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isOwner ? 'owner' : 'admin',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Eco.green,
                    ),
                  ),
                )
              else
                Text(
                  '$points ball',
                  style: const TextStyle(fontSize: 12.5, color: Eco.muted),
                ),
            ],
          ),
          if (!isOwner) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: isAdmin
                      ? OutlinedButton(
                          onPressed: busy ? null : onToggleAdmin,
                          child: const Text('Adminlikni olish'),
                        )
                      : ElevatedButton(
                          onPressed: busy ? null : onToggleAdmin,
                          child: const Text('Admin qilish'),
                        ),
                ),
                const SizedBox(width: 8),
                IconButton.outlined(
                  tooltip: 'Parolni tiklash',
                  onPressed: busy ? null : onReset,
                  icon: const Icon(Icons.key_outlined, size: 20),
                ),
                const SizedBox(width: 4),
                IconButton.outlined(
                  tooltip: 'O‘chirish',
                  onPressed: busy ? null : onDelete,
                  icon: const Icon(Icons.delete_outline, size: 20, color: Eco.brick),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CreateAdminSheet extends StatefulWidget {
  const _CreateAdminSheet();

  @override
  State<_CreateAdminSheet> createState() => _CreateAdminSheetState();
}

class _CreateAdminSheetState extends State<_CreateAdminSheet> {
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 3) {
      setState(() => _error = 'Ism va familiyani to‘liq yozing.');
      return;
    }
    if (_username.text.trim().length < 3) {
      setState(() => _error = 'Login kamida 3 ta belgidan iborat bo‘lsin.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final res = await Api.instance.post('/users', {
        'fullName': _name.text.trim(),
        'username': _username.text.trim(),
        'role': 'admin',
        if (_password.text.trim().isNotEmpty) 'password': _password.text.trim(),
      });
      if (mounted) Navigator.pop(context, res);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(e);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Eco.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Yangi admin',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Eco.ink),
              ),
              const SizedBox(height: 6),
              const Text(
                'O‘qituvchi uchun hisob yaratiladi. Parol bo‘sh qolsa, tizim o‘zi beradi.',
                style: TextStyle(fontSize: 13.5, height: 1.45, color: Eco.muted),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _name,
                enabled: !_busy,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Ism va familiya'),
              ),
              const SizedBox(height: 12),
              UsernameField(controller: _username, enabled: !_busy),
              const SizedBox(height: 12),
              PasswordField(
                controller: _password,
                obscure: _obscure,
                label: 'Parol (ixtiyoriy)',
                helper: 'Kamida 8 ta belgi',
                hints: const [],
                enabled: !_busy,
                onToggle: () => setState(() => _obscure = !_obscure),
              ),
              if (_error != null) ErrorBox(message: _error!),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: _busy ? null : _save,
                child: Text(_busy ? 'Saqlanmoqda...' : 'Admin qo‘shish'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
