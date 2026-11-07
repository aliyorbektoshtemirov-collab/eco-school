import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';
import 'admin.dart';

/// Profil: ball, o'rin, hissa va hisob sozlamalari.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    await session.refresh();

    try {
      _stats = await Api.instance.get('/stats/me');
    } catch (_) {
      _stats = null;
    }

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _changePassword() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _PasswordSheet(),
    );
  }

  Future<void> _logout() async {
    final yes = await confirm(
      context,
      title: 'Tizimdan chiqasizmi?',
      body: 'Qaytib kirish uchun login va parolingiz kerak bo‘ladi.',
      yes: 'Chiqish',
      danger: true,
    );

    if (yes) await session.logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = session.user;
    if (user == null) return const SizedBox.shrink();

    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(title: const Text('Profilim')),
      body: RefreshIndicator(
        color: Eco.green,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            EcoCard(
              child: Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(color: Eco.green, shape: BoxShape.circle),
                    child: Text(
                      user.initials,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.fullName,
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            color: Eco.ink,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              '@${user.username}',
                              style: const TextStyle(fontSize: 13, color: Eco.muted),
                            ),
                            if (user.className != null)
                              ClassTag(name: user.className),
                            if (user.isAdmin)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                decoration: BoxDecoration(
                                  color: Eco.greenTint,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  user.isOwner ? 'owner' : 'admin',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: Eco.green,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            if (user.isAdmin) ...[
              const SizedBox(height: 12),
              _AdminButton(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AdminScreen()),
                ),
              ),
            ],

            const SizedBox(height: 12),
            EcoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Eco ballaringiz',
                    style: TextStyle(fontSize: 13, color: Eco.muted),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${user.points}',
                    style: const TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w700,
                      color: Eco.green,
                      height: 1.1,
                    ),
                  ),
                  if (_stats != null && user.role == 'student') ...[
                    const SizedBox(height: 10),
                    Text(
                      _rankText(),
                      style: const TextStyle(fontSize: 13.5, height: 1.5, color: Eco.muted),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 12),
            EcoCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Mening hissam',
                    style: TextStyle(fontSize: 13, color: Eco.muted),
                  ),
                  const SizedBox(height: 14),
                  if (_loading)
                    const Text('Yuklanmoqda...', style: TextStyle(color: Eco.faint))
                  else if (_stats == null)
                    const Text('Ma’lumot olinmadi.', style: TextStyle(color: Eco.faint))
                  else ...[
                    _line('Topshiriqlar', _count('challenges', 'approved'),
                        _count('challenges', 'pending')),
                    const SizedBox(height: 12),
                    _line('Recycling', '${_kg()} kg', _count('recycling', 'pending')),
                    const SizedBox(height: 12),
                    _line('Tadqiqotlar', _count('research', 'approved'),
                        _count('research', 'pending')),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 12),
            EcoCard(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.lock_outline, color: Eco.muted, size: 21),
                    title: const Text(
                      'Parolni almashtirish',
                      style: TextStyle(fontSize: 15, color: Eco.ink),
                    ),
                    trailing: const Icon(Icons.chevron_right, color: Eco.faint),
                    onTap: _changePassword,
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.logout, color: Eco.brick, size: 21),
                    title: const Text(
                      'Tizimdan chiqish',
                      style: TextStyle(fontSize: 15, color: Eco.brick),
                    ),
                    onTap: _logout,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _rankText() {
    final rank = (_stats?['rank'] as num?)?.toInt() ?? 1;
    final toNext = (_stats?['toNext'] as num?)?.toInt();

    if (toNext == null) return 'Maktab bo‘yicha #$rank-o‘rindasiz. Hozircha birinchisiz.';
    if (toNext <= 0) return 'Maktab bo‘yicha #$rank-o‘rindasiz.';
    return 'Maktab bo‘yicha #$rank-o‘rindasiz. '
        'Oldingi o‘rinni egallash uchun yana $toNext ball kerak.';
  }

  String _count(String group, String field) {
    final map = _stats?[group] as Map<String, dynamic>?;
    return '${(map?[field] as num?)?.toInt() ?? 0}';
  }

  String _kg() {
    final map = _stats?['recycling'] as Map<String, dynamic>?;
    final kg = (map?['kg'] as num?)?.toDouble() ?? 0;
    return kg.toStringAsFixed(1);
  }

  Widget _line(String label, String value, String pending) {
    final waiting = int.tryParse(pending) ?? 0;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(label, style: const TextStyle(fontSize: 14, color: Eco.muted)),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Eco.ink),
        ),
        if (waiting > 0) ...[
          const SizedBox(width: 8),
          Text(
            '$waiting kutilmoqda',
            style: const TextStyle(fontSize: 12, color: Eco.amber),
          ),
        ],
      ],
    );
  }
}

class _AdminButton extends StatelessWidget {
  const _AdminButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Eco.green,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0x26FFFFFF),
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 21),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Admin panel',
                    style: TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Tasdiqlash, vazifalar, o‘quvchilar',
                    style: TextStyle(fontSize: 12.5, color: Color(0xCCFFFFFF)),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0x99FFFFFF)),
          ],
        ),
      ),
    );
  }
}

class _PasswordSheet extends StatefulWidget {
  const _PasswordSheet();

  @override
  State<_PasswordSheet> createState() => _PasswordSheetState();
}

class _PasswordSheetState extends State<_PasswordSheet> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_next.text.length < 8) {
      setState(() => _error = 'Yangi parol kamida 8 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (_next.text != _repeat.text) {
      setState(() => _error = 'Yangi parol ikki joyda bir xil yozilmagan.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final res = await Api.instance.post('/auth/change-password', {
        'currentPassword': _current.text,
        'newPassword': _next.text,
      });

      if (mounted) {
        Navigator.pop(context);
        showNote(context, res['message'] as String? ?? 'Parol almashtirildi.');
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Parolni almashtirish',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Eco.ink),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Hozirgi parol'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _next,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Yangi parol',
                helperText: 'Kamida 8 ta belgi',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _repeat,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Takrorlang'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!, style: const TextStyle(fontSize: 13.5, color: Eco.brick)),
            ],
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: _busy ? null : _save,
              child: Text(_busy ? 'Saqlanmoqda...' : 'Saqlash'),
            ),
          ],
        ),
      ),
    );
  }
}
