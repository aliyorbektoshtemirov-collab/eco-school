import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Kirish va ro'yxatdan o'tish.
///
/// Ikki bo'lim alohida widget: maydonlar ham, ularning matni ham
/// bir-biriga aralashmaydi.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _registering = false;

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
                            if (value == _registering) return;
                            // Klaviatura ochiq qolsa, eski maydonga yozilib ketadi.
                            FocusManager.instance.primaryFocus?.unfocus();
                            setState(() => _registering = value);
                          },
                        ),
                        const SizedBox(height: 20),

                        // Har bo'lim o'z holatiga ega — kalit almashgach
                        // eski maydonlar butunlay yo'q qilinadi.
                        if (_registering)
                          const RegisterForm(key: ValueKey('register'))
                        else
                          const SignInForm(key: ValueKey('signin')),
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

/* ============================================================== kirish */

class SignInForm extends StatefulWidget {
  const SignInForm({super.key});

  @override
  State<SignInForm> createState() => _SignInFormState();
}

class _SignInFormState extends State<SignInForm> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _username.text.trim();
    final password = _password.text;

    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Login va parolni kiriting.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await session.login(username, password);
      // Android parolni saqlashni taklif qilsin.
      TextInput.finishAutofillContext();
      return; // ekran almashadi, setState kerak emas
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = errorText(e);
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          UsernameField(
            controller: _username,
            enabled: !_busy,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => _passwordFocus.requestFocus(),
          ),
          const SizedBox(height: 14),
          PasswordField(
            controller: _password,
            focusNode: _passwordFocus,
            obscure: _obscure,
            enabled: !_busy,
            label: 'Parol',
            hints: const [AutofillHints.password],
            onToggle: () => setState(() => _obscure = !_obscure),
            onSubmitted: (_) => _busy ? null : _submit(),
          ),
          if (_error != null) ErrorBox(message: _error!),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Kutilmoqda...' : 'Kirish'),
          ),
        ],
      ),
    );
  }
}

/* ================================================= ro'yxatdan o'tish */

class RegisterForm extends StatefulWidget {
  const RegisterForm({super.key});

  @override
  State<RegisterForm> createState() => _RegisterFormState();
}

class _RegisterFormState extends State<RegisterForm> {
  final _fullName = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _usernameFocus = FocusNode();
  final _passwordFocus = FocusNode();

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  /// Maktablar: {code, name}. Bitta bo'lsa o'zi tanlanadi.
  List<Map<String, dynamic>> _schools = const [];
  String? _schoolCode;

  List<String> _classes = const [];
  String? _className;

  bool _loadingSchools = true;
  bool _loadingClasses = false;

  @override
  void initState() {
    super.initState();
    _loadSchools();
  }

  @override
  void dispose() {
    _fullName.dispose();
    _username.dispose();
    _password.dispose();
    _usernameFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _loadSchools() async {
    setState(() {
      _loadingSchools = true;
      _error = null;
    });

    try {
      final res = await Api.instance.get('/auth/schools');
      final list = (res['schools'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .where((s) => (s['code'] as String? ?? '').isNotEmpty)
          .toList();

      if (!mounted) return;
      setState(() {
        _schools = list;
        _loadingSchools = false;
        if (list.length == 1) _schoolCode = list.first['code'] as String;
      });

      if (_schoolCode != null) await _loadClasses();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingSchools = false;
        _error = errorText(e);
      });
    }
  }

  Future<void> _loadClasses() async {
    final code = _schoolCode;
    if (code == null) return;

    setState(() {
      _loadingClasses = true;
      _error = null;
    });

    try {
      final res = await Api.instance.get('/auth/classes?code=$code');
      final list = (res['classes'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map<String>((e) => '${e['class_name'] ?? ''}')
          .where((name) => name.isNotEmpty)
          .toList();

      if (!mounted) return;
      setState(() {
        _classes = list;
        if (!list.contains(_className)) _className = null;
        _loadingClasses = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _classes = const [];
        _className = null;
        _loadingClasses = false;
        _error = errorText(e);
      });
    }
  }

  Future<void> _submit() async {
    final name = _fullName.text.trim();
    final username = _username.text.trim();
    final password = _password.text;

    if (name.length < 3) {
      setState(() => _error = 'Ism va familiyangizni to‘liq yozing.');
      return;
    }
    if (username.length < 3) {
      setState(() => _error = 'Login kamida 3 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (password.length < 8) {
      setState(() => _error = 'Parol kamida 8 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (_schoolCode == null) {
      setState(() => _error = 'Maktabingizni tanlang.');
      return;
    }
    if (_className == null) {
      setState(() => _error = 'Sinfingizni tanlang.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await session.register(
        username: username,
        password: password,
        fullName: name,
        className: _className!,
        schoolCode: _schoolCode!,
      );
      TextInput.finishAutofillContext();
      return;
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = errorText(e);
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _fullName,
            enabled: !_busy,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            decoration: const InputDecoration(
              labelText: 'Ism va familiya',
              hintText: 'Alisher Valiyev',
            ),
            onSubmitted: (_) => _usernameFocus.requestFocus(),
          ),
          const SizedBox(height: 14),

          _schoolSelector(),
          const SizedBox(height: 14),
          _classSelector(),
          const SizedBox(height: 14),

          UsernameField(
            controller: _username,
            focusNode: _usernameFocus,
            enabled: !_busy,
            helper: 'Lotin harflari, raqam, _ va . — bo‘sh joysiz',
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => _passwordFocus.requestFocus(),
          ),
          const SizedBox(height: 14),
          PasswordField(
            controller: _password,
            focusNode: _passwordFocus,
            obscure: _obscure,
            enabled: !_busy,
            label: 'Parol',
            helper: 'Kamida 8 ta belgi',
            hints: const [AutofillHints.newPassword],
            onToggle: () => setState(() => _obscure = !_obscure),
            onSubmitted: (_) => _busy ? null : _submit(),
          ),

          if (_error != null) ErrorBox(message: _error!),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? 'Kutilmoqda...' : 'Ro‘yxatdan o‘tish'),
          ),
        ],
      ),
    );
  }

  Widget _schoolSelector() {
    if (_loadingSchools) {
      return const _FieldNote(text: 'Maktablar yuklanmoqda...', busy: true);
    }

    if (_schools.isEmpty) {
      return Row(
        children: [
          const Expanded(
            child: Text(
              'Maktablar ro‘yxati olinmadi.',
              style: TextStyle(fontSize: 13.5, color: Eco.muted),
            ),
          ),
          TextButton(onPressed: _loadSchools, child: const Text('Qayta urinish')),
        ],
      );
    }

    // Bitta maktab bo'lsa tanlash shart emas — nomini ko'rsatamiz.
    if (_schools.length == 1) {
      final school = _schools.first;
      final name = school['name'] as String? ?? '';
      return _FieldNote(
        text: name.isEmpty ? 'Maktab: ${school['code']}' : name,
        icon: Icons.school_outlined,
      );
    }

    return DropdownButtonFormField<String>(
      value: _schoolCode,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Maktab'),
      hint: const Text('Maktabingizni tanlang'),
      items: _schools
          .map((s) => DropdownMenuItem(
                value: s['code'] as String,
                child: Text(
                  s['name'] as String? ?? s['code'] as String,
                  overflow: TextOverflow.ellipsis,
                ),
              ))
          .toList(),
      onChanged: _busy
          ? null
          : (value) {
              setState(() {
                _schoolCode = value;
                _classes = const [];
                _className = null;
              });
              _loadClasses();
            },
    );
  }

  Widget _classSelector() {
    if (_loadingClasses) {
      return const _FieldNote(text: 'Sinflar yuklanmoqda...', busy: true);
    }

    return DropdownButtonFormField<String>(
      value: _className,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: 'Sinf',
        suffixIcon: _classes.isEmpty && _schoolCode != null
            ? IconButton(
                icon: const Icon(Icons.refresh, size: 20),
                onPressed: _loadClasses,
              )
            : null,
      ),
      hint: Text(_classes.isEmpty ? 'Sinflar topilmadi' : 'Sinfingizni tanlang'),
      items: _classes
          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
          .toList(),
      onChanged: _busy || _classes.isEmpty
          ? null
          : (value) => setState(() => _className = value),
    );
  }
}

/* ========================================================= umumiy qismlar */

class _FieldNote extends StatelessWidget {
  const _FieldNote({required this.text, this.busy = false, this.icon});

  final String text;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F6F1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          if (busy)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Eco.green),
            )
          else if (icon != null)
            Icon(icon, size: 19, color: Eco.green),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 14, color: Eco.ink),
            ),
          ),
        ],
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
          _tab('Kirish', !registering, () => onChanged(false)),
          _tab('Ro‘yxatdan o‘tish', registering, () => onChanged(true)),
        ],
      ),
    );
  }

  Widget _tab(String label, bool active, VoidCallback onTap) {
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
