import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Mentorlar: hamma ko'radi, owner qo'shadi va tahrirlaydi.
class MentorsScreen extends StatefulWidget {
  const MentorsScreen({super.key});

  @override
  State<MentorsScreen> createState() => _MentorsScreenState();
}

class _MentorsScreenState extends State<MentorsScreen> {
  String _intro = '';
  List<dynamic> _mentors = const [];
  bool _loading = true;
  String? _error;

  bool get _isOwner => session.user?.isOwner == true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await Api.instance.get('/mentors');
      if (!mounted) return;
      setState(() {
        _intro = res['intro'] as String? ?? '';
        _mentors = (res['mentors'] as List?) ?? const [];
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

  Future<void> _edit([Map<String, dynamic>? mentor]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _MentorSheet(mentor: mentor),
    );
    if (saved == true) _load();
  }

  Future<void> _remove(Map<String, dynamic> m) async {
    final yes = await confirm(
      context,
      title: 'Olib tashlaysizmi?',
      body: '${m['full_name']} ro‘yxatdan o‘chadi.',
      yes: 'Olib tashlash',
      danger: true,
    );
    if (!yes) return;
    try {
      await Api.instance.delete('/admin/mentors/${m['id']}');
      _load();
    } catch (e) {
      if (mounted) showNote(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      appBar: AppBar(title: const Text('Mentorlar')),
      floatingActionButton: _isOwner
          ? FloatingActionButton.extended(
              onPressed: () => _edit(),
              backgroundColor: Eco.green,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('Mentor qo‘shish'),
            )
          : null,
      body: RefreshIndicator(
        color: Eco.green,
        onRefresh: _load,
        child: _loading
            ? ListView(children: const [Loading()])
            : _error != null
                ? ListView(children: [ErrorNote(message: _error!, onRetry: _load)])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    children: [
                      if (_intro.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Eco.greenTint,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            _intro,
                            style: const TextStyle(fontSize: 14.5, height: 1.5, color: Eco.green),
                          ),
                        ),
                      const SizedBox(height: 12),
                      if (_mentors.isEmpty)
                        const EmptyNote(
                          title: 'Hozircha mentor yo‘q',
                          hint: 'Owner mentor qo‘shgach shu yerda ko‘rinadi.',
                          icon: Icons.school_outlined,
                        )
                      else
                        ..._mentors.map((raw) {
                          final m = (raw as Map).cast<String, dynamic>();
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _MentorCard(
                              mentor: m,
                              owner: _isOwner,
                              onEdit: () => _edit(m),
                              onRemove: () => _remove(m),
                            ),
                          );
                        }),
                    ],
                  ),
      ),
    );
  }
}

class _MentorCard extends StatelessWidget {
  const _MentorCard({
    required this.mentor,
    required this.owner,
    required this.onEdit,
    required this.onRemove,
  });

  final Map<String, dynamic> mentor;
  final bool owner;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final name = mentor['full_name'] as String? ?? '';
    final title = mentor['title'] as String?;
    final bio = mentor['bio'] as String?;
    final hasPhoto = mentor['has_photo'] == true;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Eco.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Eco.rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 4 / 4.4,
            child: hasPhoto
                ? Image.network(
                    '${Api.baseUrl}/api/mentors/files/${mentor['id']}',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _Initial(name),
                  )
                : _Initial(name),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    color: Eco.ink,
                  ),
                ),
                if (title != null && title.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: Eco.green,
                    ),
                  ),
                ],
                if (bio != null && bio.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    bio,
                    style: const TextStyle(fontSize: 14.5, height: 1.5, color: Eco.muted),
                  ),
                ],
                if (owner) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      OutlinedButton(
                        onPressed: onEdit,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                        child: const Text('Tahrirlash'),
                      ),
                      TextButton(
                        onPressed: onRemove,
                        style: TextButton.styleFrom(foregroundColor: Eco.brick),
                        child: const Text('Olib tashlash'),
                      ),
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

class _Initial extends StatelessWidget {
  const _Initial(this.name);

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Eco.greenTint,
      alignment: Alignment.center,
      child: Text(
        name.isEmpty ? '?' : name[0].toUpperCase(),
        style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, color: Eco.green),
      ),
    );
  }
}

class _MentorSheet extends StatefulWidget {
  const _MentorSheet({this.mentor});

  final Map<String, dynamic>? mentor;

  @override
  State<_MentorSheet> createState() => _MentorSheetState();
}

class _MentorSheetState extends State<_MentorSheet> {
  late final _name = TextEditingController(text: widget.mentor?['full_name'] as String? ?? '');
  late final _title = TextEditingController(text: widget.mentor?['title'] as String? ?? '');
  late final _bio = TextEditingController(text: widget.mentor?['bio'] as String? ?? '');
  File? _photo;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _title.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );
      if (picked != null) setState(() => _photo = File(picked.path));
    } catch (_) {
      setState(() => _error = 'Rasmni ochib bo‘lmadi.');
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 3) {
      setState(() => _error = 'Ism va familiyani to‘liq yozing.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final body = <String, dynamic>{
        'fullName': _name.text.trim(),
        'title': _title.text.trim(),
        'bio': _bio.text.trim(),
      };
      if (_photo != null) body['photoKey'] = await Api.instance.uploadImage(_photo!);

      final id = widget.mentor?['id'];
      if (id == null) {
        await Api.instance.post('/admin/mentors', body);
      } else {
        await Api.instance.put('/admin/mentors/$id', body);
      }
      if (mounted) Navigator.pop(context, true);
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
              Text(
                widget.mentor == null ? 'Yangi mentor' : 'Mentorni tahrirlash',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Eco.ink),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _busy ? null : _pick,
                icon: const Icon(Icons.photo_library_outlined),
                label: Text(_photo == null ? 'Rasm tanlash' : 'Rasm tanlandi ✓'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _name,
                enabled: !_busy,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Ism va familiya'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _title,
                enabled: !_busy,
                decoration: const InputDecoration(
                  labelText: 'Lavozimi yoki sohasi',
                  hintText: 'Masalan: ekolog',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _bio,
                enabled: !_busy,
                maxLines: 4,
                maxLength: 1500,
                decoration: const InputDecoration(labelText: 'Ma’lumot'),
              ),
              if (_error != null) ErrorBox(message: _error!),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _busy ? null : _save,
                child: Text(_busy ? 'Saqlanmoqda...' : 'Saqlash'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
