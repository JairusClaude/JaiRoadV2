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

    /**
     * Validate a deliberately submitted snapshot, without retaining its bytes.
     * This is a capture checkpoint, NOT biometric identity or liveness proof.
     */
    public function cameraReceipt(int $account, string $scope, string $token, string $jpeg): string
    {
        $claim = $this->claim($token, $account, $scope);
        if (Cache::has('jairoads:deletion-challenge:'.$claim['nonce'])) {
            $this->invalid();
        }
        $size = strlen($jpeg);
        $info = $size >= 128 && $size <= 524288 ? @getimagesizefromstring($jpeg) : false;
        if ($info === false || $info[2] !== IMAGETYPE_JPEG || $info[0] < 160 || $info[1] < 120
            || $info[0] > 640 || $info[1] > 640 || ! str_ends_with($jpeg, "\xFF\xD9")) {
            throw ValidationException::withMessages(['camera_receipt' => 'Capture a valid camera photo and try again.']);
        }

        // No photo, hash of photo, face template or image URL is persisted.
        return Crypt::encryptString(json_encode([
            'purpose' => 'deletion-camera',
            'account' => $account, 'scope' => $scope,
            'challenge' => hash('sha256', $token), 'expires' => $claim['expires'],
        ], JSON_THROW_ON_ERROR));
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
            || ! is_string($claim['nonce'] ?? null)) {
            $this->invalid();
        }

        return $claim;
    }

    public function verify(Request $request, int $account, string $scope): void
    {
        $v = $request->validate([
            'confirmation' => ['required', 'in:YES'],
            'captcha_token' => ['required', 'string', 'max:4096'],
            'captcha_answer' => ['required', 'integer', 'between:0,999'],
            'camera_receipt' => ['required', 'string', 'max:4096'],
        ]);
        $claim = $this->claim($v['captcha_token'], $account, $scope);
        try {
            $receipt = json_decode(Crypt::decryptString($v['camera_receipt']), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            $receipt = null;
        }
        if (! is_array($receipt) || ($receipt['purpose'] ?? null) !== 'deletion-camera'
            || ($receipt['account'] ?? null) !== $account || ($receipt['scope'] ?? null) !== $scope
            || ($receipt['expires'] ?? null) !== $claim['expires']
            || ! is_string($receipt['challenge'] ?? null)
            || ! hash_equals(hash('sha256', $v['captcha_token']), $receipt['challenge'])) {
            throw ValidationException::withMessages(['camera_receipt' => 'Take a new camera photo for this verification challenge.']);
        }
        // Consume even on an incorrect answer. A retry requires a fresh challenge.
        if (! Cache::add('jairoads:deletion-challenge:'.$claim['nonce'], true, now()->addMinutes(6))
            || ($claim['answer'] ?? null) !== (int) $v['captcha_answer']) {
            $this->invalid();
        }
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['captcha_answer' => 'Verification was incorrect, expired or already used. Request a new challenge.']);
    }
}
