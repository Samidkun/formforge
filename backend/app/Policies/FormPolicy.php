<?php
// backend/app/Policies/FormPolicy.php
namespace App\Policies;

use App\Models\Form;
use App\Models\User;

class FormPolicy
{
    private function owns(User $user, Form $form): bool
    {
        return (int) $form->workspace->owner_id === (int) $user->id;
    }

    public function view(User $user, Form $form): bool { return $this->owns($user, $form); }
    public function update(User $user, Form $form): bool { return $this->owns($user, $form); }
    public function delete(User $user, Form $form): bool { return $this->owns($user, $form); }
}
