// Explicit file partitions: no test-name filters, skips, expected failures, or
// exit-code rewriting. The diagnostic profile is the complete superset.
export const required = [
  'authorization.test.mjs',
  'ownership.test.mjs',
  'native-auth.test.mjs',
  'reference-audit.test.mjs',
];
export const diagnostic = [...required, 'issuer-conformance.test.mjs'];
export function integrationProfile(args) {
  const options = args.filter((arg) => arg.startsWith('--profile='));
  if (options.length > 1 || args.some((arg) => arg !== '--cleanup' && !arg.startsWith('--profile='))) {
    throw new Error('Use --profile=required, --profile=diagnostic, or --cleanup; arbitrary test filters are forbidden');
  }
  const name = options[0]?.slice('--profile='.length) ?? 'required';
  if (!['required', 'diagnostic'].includes(name)) throw new Error('Unknown integration profile');
  return { name, files: name === 'required' ? required : diagnostic };
}
