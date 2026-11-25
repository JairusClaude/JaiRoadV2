<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;

/** Additional human confirmation, not a replacement for authentication or CSRF. */
final class DeletionChallenge
{
    /** @return array{question:string,token:string} */
    public function issue(int $account, string $scope): array
    {
        $left = random_int(10, 49);
        $right = random_int(2, 29);

        return [
            'question' => "{$left} + {$right}",
            'token' => Crypt::encryptString(json_encode([
                'account' => $account, 'scope' => $scope, 'answer' => $left + $right,
                'nonce' => bin2hex(random_bytes(24)), 'expires' => time() + 300,
            ], JSON_THROW_ON_ERROR)),
        ];
    }

    /** @return array{account:int,scope:string,answer:int,nonce:string,expires:int} */
    private function claim(string $token, int $account, string $scope): array
    {
        try {
            $claim = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            $this->invalid();
        }
        if (! is_array($claim) || ($claim['account'] ?? null) !== $account || ($claim['scope'] ?? null) !== $scope
            || ! is_int($claim['expires'] ?? null) || $claim['expires'] < time()
            || ! is_int($claim['answer'] ?? null)
            || ! is_string($claim['nonce'] ?? null)) {
            $this->invalid();
        }

        // Return only the validated fields: a decrypted JSON array is not
        // automatically a typed deletion challenge.
        return [
            'account' => $account,
            'scope' => $scope,
            'answer' => $claim['answer'],
            'nonce' => $claim['nonce'],
            'expires' => $claim['expires'],
        ];
    }

    public function verify(Request $request, int $account, string $scope): void
    {
        $v = $request->validate([
            'confirmation' => ['required', 'in:YES'],
            'captcha_token' => ['required', 'string', 'max:4096'],
            'captcha_answer' => ['required', 'integer', 'between:0,999'],
        ]);
        $claim = $this->claim($v['captcha_token'], $account, $scope);
        // Consume even on an incorrect answer. A retry requires a fresh challenge.
        if (! Cache::add('jairoads:deletion-challenge:'.$claim['nonce'], true, now()->addMinutes(6))
            || $claim['answer'] !== (int) $v['captcha_answer']) {
            $this->invalid();
        }
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['captcha_answer' => 'Verification was incorrect, expired or already used. Request a new challenge.']);
    }
}
