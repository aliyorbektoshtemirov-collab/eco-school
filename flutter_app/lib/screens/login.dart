import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Kirish va ro'yxatdan o'tish — saytdagidek ikki bo'lim.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _registering = false;
  bool _busy = false;
  String? _error;

  final _username = TextEditingController();
  final _password = TextEditingController();
  final _fullName = TextEditingController();
  final _schoolCode = TextEditingController(text: 'ANDIJON01');

  String? _className;
  List<String> _classes = const [];
  bool _loadingClasses = false;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _fullName.dispose();
    _schoolCode.dispose();
    super.dispose();
  }

  /// Maktab kodi kiritilgach sinflar ro'yxati yuklanadi.
  Future<void> _loadClasses() async {
    final code = _schoolCode.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _loadingClasses = true;
      _error = null;
    });

    try {
      final res = await Api.instance.get('/auth/classes?code=$code');
      final list = (res['classes'] as List?) ?? const [];
      setState(() {
        // Server {class_name: "7-A"} ko'rinishida qaytaradi
        _classes = list
            .map((e) => (e as Map<String, dynamic>)['class_name'].toString())
            .toList();
        if (!_classes.contains(_className)) _className = null;
      });
    } on ApiException catch (e) {
      setState(() {
        _classes = const [];
        _error = e.message;
      });
    }

    if (mounted) setState(() => _loadingClasses = false);
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      if (_registering) {
        if (_className == null) {
          throw ApiException(422, 'Sinfingizni tanlang.');
        }
        await session.register(
          username: _username.text,
          password: _password.text,
          fullName: _fullName.text,
          className: _className!,
          schoolCode: _schoolCode.text,
        );
      } else {
        await session.login(_username.text, _password.text);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Nimadir xato ketdi. Qaytadan urinib ko‘ring.');
    }

    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Eco.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 12),
                  Image.asset('assets/timo.png', height: 110),
                  const SizedBox(height: 14),
                  const Text(
                    'ECO SCHOOL',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2.5,
                      color: Eco.green,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _registering ? 'Ro‘yxatdan o‘tish' : 'Xush kelibsiz',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: Eco.ink,
                    ),
                  ),
                  const SizedBox(height: 26),

                  EcoCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _Tabs(
                          registering: _registering,
                          onChanged: (value) {
                            setState(() {
                              _registering = value;
                              _error = null;
                            });
                            if (value && _classes.isEmpty) _loadClasses();
                          },
                        ),
                        const SizedBox(height: 20),

                        if (_registering) ...[
                          TextField(
                            controller: _fullName,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              labelText: 'Ism va familiya',
                              hintText: 'Alisher Valiyev',
                            ),
                          ),
                          const SizedBox(height: 14),
                          TextField(
                            controller: _schoolCode,
                            textCapitalization: TextCapitalization.characters,
                            onEditingComplete: _loadClasses,
                            decoration: InputDecoration(
                              labelText: 'Maktab kodi',
                              suffixIcon: IconButton(
                                icon: _loadingClasses
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : const Icon(Icons.refresh, size: 20),
                                onPressed: _loadingClasses ? null : _loadClasses,
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<String>(
                            value: _className,
                            isExpanded: true,
                            decoration: const InputDecoration(labelText: 'Sinf'),
                            hint: Text(
                              _classes.isEmpty
                                  ? 'Avval maktab kodini kiriting'
                                  : 'Sinfingizni tanlang',
                            ),
                            items: _classes
                                .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                                .toList(),
                            onChanged: (value) => setState(() => _className = value),
                          ),
                          const SizedBox(height: 14),
                        ],

                        TextField(
                          controller: _username,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: 'Login',
                            hintText: 'a.valiyev',
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _password,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: 'Parol',
                            helperText: _registering ? 'Kamida 8 ta belgi' : null,
                          ),
                          onSubmitted: (_) => _busy ? null : _submit(),
                        ),

                        if (_error != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Eco.brickTint,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                fontSize: 13.5,
                                height: 1.45,
                                color: Eco.brick,
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: _busy ? null : _submit,
                          child: Text(
                            _busy
                                ? 'Kutilmoqda...'
                                : _registering
                                    ? 'Ro‘yxatdan o‘tish'
                                    : 'Kirish',
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 22),
                  const Text(
                    'Email kerak emas — faqat login va parol.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: Eco.muted),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.registering, required this.onChanged});

  final bool registering;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFE9EFE6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _tab(context, 'Kirish', !registering, () => onChanged(false)),
          _tab(context, 'Ro‘yxatdan o‘tish', registering, () => onChanged(true)),
        ],
      ),
    );
  }

  Widget _tab(BuildContext context, String label, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: active ? Eco.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: active ? Eco.ink : Eco.muted,
            ),
          ),
        ),
      ),
    );
  }
}
