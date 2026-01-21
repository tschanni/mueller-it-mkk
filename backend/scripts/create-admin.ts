import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserRole } from '../src/users/schemas/user.schema';
import * as argon2 from 'argon2';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function bootstrap() {
  console.log('🔧 Admin-Konto erstellen\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  try {
    // Check if admin exists
    const existingAdmin = await userModel.findOne({ role: UserRole.ADMIN });
    
    if (existingAdmin) {
      console.log('⚠️  Es existiert bereits ein Admin-Konto:');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   E-Mail: ${existingAdmin.email}\n`);
      
      const overwrite = await question('Möchtest du ein weiteres Admin-Konto erstellen? (j/n): ');
      if (overwrite.toLowerCase() !== 'j' && overwrite.toLowerCase() !== 'ja') {
        console.log('Abbruch.');
        await app.close();
        rl.close();
        return;
      }
    }

    // Get admin data
    const username = await question('\nUsername: ');
    const email = await question('E-Mail: ');
    const password = await question('Passwort (min. 8 Zeichen): ');
    const firmenname = await question('Firmenname (optional): ');

    // Validation
    if (!username || username.length < 3) {
      throw new Error('Username muss mindestens 3 Zeichen lang sein');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Ungültige E-Mail-Adresse');
    }
    if (!password || password.length < 8) {
      throw new Error('Passwort muss mindestens 8 Zeichen lang sein');
    }

    // Check if username or email already exists
    const existingUser = await userModel.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      throw new Error('Username oder E-Mail bereits vergeben');
    }

    // Hash password
    const hashedPassword = await argon2.hash(password);

    // Create admin user
    const admin = new userModel({
      username,
      email,
      password: hashedPassword,
      firmenname: firmenname || undefined,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await admin.save();

    console.log('\n✅ Admin-Konto erfolgreich erstellt!');
    console.log(`   Username: ${username}`);
    console.log(`   E-Mail: ${email}`);
    console.log(`   Rolle: ADMIN\n`);
    console.log('Du kannst dich jetzt mit diesen Daten anmelden.\n');

  } catch (error) {
    console.error('\n❌ Fehler:', error.message);
  } finally {
    await app.close();
    rl.close();
  }
}

bootstrap();
