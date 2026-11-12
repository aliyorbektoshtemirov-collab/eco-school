import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'site_page.dart';
import 'leaderboard.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../session.dart';
import '../widgets.dart';
import 'admin.dart';
import 'admin_users.dart';
import 'mentors.dart';

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

  bool _avatarBusy = false;
  Future<void> _avatar() async {
    if (_avatarBusy) return;
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, maxHeight: 1200, imageQuality: 85);
    if (file == null || !mounted) return;
    setState(() => _avatarBusy = true);
    try {
      final key = await Api.instance.uploadImage(File(file.path));
      await Api.instance.put('/users/me/avatar', {'key': key});
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorText(e))));
    } finally { if (mounted) setState(() => _avatarBusy = false); }
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

    final rank = (_stats?['rank'] as num?)?.toInt();

    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(title: const Text('Profilim')),
      body: RefreshIndicator(
        color: Eco.green,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            _Hero(user: user, rank: user.role == 'student' ? rank : null, hint: _hint(user)),
            const SizedBox(height: 12),
            Row(
              children: [
                _Tile(
                  icon: Icons.check_circle_outline,
                  color: Eco.green,
                  value: _loading ? '…' : _count('challenges', 'approved'),
                  label: 'Topshiriq',
                ),
                const SizedBox(width: 10),
                _Tile(
                  icon: Icons.recycling,
                  color: const Color(0xFF3E7C52),
                  value: _loading ? '…' : '${_kg()} kg',
                  label: 'Recycling',
                ),
                const SizedBox(width: 10),
                _Tile(
                  icon: Icons.biotech_outlined,
                  color: const Color(0xFF2B6C8F),
                  value: _loading ? '…' : _count('research', 'approved'),
                  label: 'Tadqiqot',
                ),
              ],
            ),
            const SizedBox(height: 12),
            EcoCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(leading: const Icon(Icons.add_a_photo_outlined), title: Text(_avatarBusy ? 'Yuklanmoqda…' : 'Profil rasmini tanlash'), onTap: _avatarBusy ? null : _avatar),
                  ListTile(leading: const Icon(Icons.emoji_events_outlined), title: const Text('Reyting'), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LeaderboardScreen()))),
                  ...[
                    ['/impact', 'Natijalar'],
                    ['/class-leaderboard', 'Sinflar reytingi'],
                    ['/research', 'Eco Research'],
                    ['/calendar', 'Taqvim'],
                  ].map((item) => ListTile(leading: const Icon(Icons.eco_outlined), title: Text(item[1]), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SitePage(path: item[0], title: item[1]))))),
                  if (user.isAdmin)
                    _Row(
                      icon: Icons.inventory_2_outlined,
                      tint: Eco.greenTint,
                      color: Eco.green,
                      title: 'Admin panel',
                      sub: 'Tasdiqlash va boshqaruv',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AdminScreen()),
                      ),
                    ),
                  if (user.isOwner)
                    _Row(
                      icon: Icons.admin_panel_settings_outlined,
                      tint: Eco.amberTint,
                      color: Eco.amber,
                      title: 'Owner paneli',
                      sub: 'Admin tayinlash, parol tiklash',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const UserAdminScreen()),
                      ),
                    ),
                  _Row(
                    icon: Icons.school_outlined,
                    tint: const Color(0xFFE8F1F7),
                    color: const Color(0xFF2B6C8F),
                    title: 'Mentorlar',
                    sub: 'Mutaxassislar bilan tanishing',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const MentorsScreen()),
                    ),
                  ),
                  _Row(
                    icon: Icons.key_outlined,
                    tint: const Color(0xFFF1F3EE),
                    color: Eco.muted,
                    title: 'Parolni almashtirish',
                    sub: 'Hisob xavfsizligi',
                    onTap: _changePassword,
                  ),
                  _Row(
                    icon: Icons.logout,
                    tint: Eco.brickTint,
                    color: Eco.brick,
                    title: 'Tizimdan chiqish',
                    sub: 'Qayta kirish uchun login kerak',
                    danger: true,
                    last: true,
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

  String? _hint(EcoUser user) {
    if (user.role != 'student' || _stats == null) return null;
    final toNext = (_stats?['toNext'] as num?)?.toInt();
    if (toNext == null) return 'Hozircha birinchisiz';
    if (toNext <= 0) return null;
    return 'Keyingi o‘ringacha yana $toNext ball';
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
}

class _Hero extends StatelessWidget {
  const _Hero({required this.user, required this.rank, required this.hint});

  final EcoUser user;
  final int? rank;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2F5D3A), Color(0xFF3F7A4D)],
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x332F5D3A), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -4,
            top: 6,
            child: Image.asset('assets/timo.png', width: 104, height: 104),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0x33FFFFFF),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0x66FFFFFF), width: 1.5),
                  ),
                  child: user.raw['avatar_key'] != null ? ClipOval(child: Image.network(Api.instance.fileUrl(user.raw['avatar_key'] as String), headers: {'Authorization': 'Bearer ${Api.instance.token}'}, width: 52, height: 52, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Text(user.initials))) : Text(
                    user.initials,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.only(right: 90),
                  child: Text(
                    user.fullName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.15,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    '@${user.username}',
                    if (user.className != null) user.className!,
                    if (user.isOwner) 'owner' else if (user.isAdmin) 'Eco Team',
                  ].join(' · '),
                  style: const TextStyle(fontSize: 13, color: Color(0xCCFFFFFF)),
                ),
                const SizedBox(height: 18),
                const Text('Eco ball', style: TextStyle(fontSize: 13, color: Color(0xCCFFFFFF))),
                Text(
                  '${user.points}',
                  style: const TextStyle(
                    fontSize: 46,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    height: 1.05,
                  ),
                ),
                if (rank != null) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _Pill('Maktabda #$rank'),
                      if (hint != null) _Pill(hint!),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0x29FFFFFF),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.white),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.color,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final Color color;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 6),
        decoration: BoxDecoration(
          color: Eco.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Eco.rule),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(height: 8),
            FittedBox(
              child: Text(
                value,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: Eco.ink,
                ),
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 12.5, color: Eco.muted)),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.tint,
    required this.color,
    required this.title,
    required this.sub,
    required this.onTap,
    this.danger = false,
    this.last = false,
  });

  final IconData icon;
  final Color tint;
  final Color color;
  final String title;
  final String sub;
  final VoidCallback onTap;
  final bool danger;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tint,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(icon, color: color, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: danger ? Eco.brick : Eco.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(sub, style: const TextStyle(fontSize: 12.5, color: Eco.muted)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Eco.faint),
              ],
            ),
          ),
        ),
        if (!last) const Divider(height: 1, indent: 74),
      ],
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
  bool _obscure = true;
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Parolni almashtirish',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Eco.ink),
            ),
            const SizedBox(height: 18),
            // Bu yerda avtoto'ldirish o'chirilgan: telefon saqlangan parolni
            // uchala maydonga ham qo'yib yuborardi.
            PasswordField(
              controller: _current,
              obscure: _obscure,
              label: 'Hozirgi parol',
              hints: const [],
              enabled: !_busy,
              onToggle: () => setState(() => _obscure = !_obscure),
            ),
            const SizedBox(height: 12),
            PasswordField(
              controller: _next,
              obscure: _obscure,
              label: 'Yangi parol',
              helper: 'Kamida 8 ta belgi',
              hints: const [],
              enabled: !_busy,
              onToggle: () => setState(() => _obscure = !_obscure),
            ),
            const SizedBox(height: 12),
            PasswordField(
              controller: _repeat,
              obscure: _obscure,
              label: 'Takrorlang',
              hints: const [],
              enabled: !_busy,
              onToggle: () => setState(() => _obscure = !_obscure),
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
