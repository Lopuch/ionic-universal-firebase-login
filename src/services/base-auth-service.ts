import { Injectable } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/auth";
import {
    AngularFirestore,
    AngularFirestoreDocument,
} from "@angular/fire/firestore";
import { Router } from "@angular/router";
import { Facebook } from "@ionic-native/facebook/ngx";
import { GooglePlus } from "@ionic-native/google-plus/ngx";
import { Platform } from "@ionic/angular";
import { Cacheable } from "ngx-cacheable";
import { Observable, of } from "rxjs";
import { switchMap } from "rxjs/operators";
import { FirebaseUserModel } from "../model/firebase-user-model";
import { UserModel } from "../model/user-model";
import { FacebookAuth } from "../modules/facebook/facebook-auth";
import { GoogleAuth } from "../modules/google/google-auth";
import { IAuthOptions } from "./i-auth-options";
import { IAuthProviderOptions } from "./i-auth-provider-options";
import { IAuthService } from "./i-auth-service";

@Injectable({
    providedIn: "root",
})
export class BaseAuthService<User extends UserModel = UserModel>
    implements IAuthService {
    protected options: IAuthOptions = {
        afterLoginPage: "/",
        firebaseUserTable: "users",
        loginPage: "/login",
    };
    protected providerOptions: IAuthProviderOptions = {
        google: {
            offline: true,
            scopes: "profile email",
            webClientId: "xxxxxx.apps.googleusercontent.com",
        },
    };

    public constructor(
        protected angularFireAuth: AngularFireAuth,
        protected angularFirestore: AngularFirestore,
        protected router: Router,
        protected platform: Platform,
        protected googleAuth: GooglePlus,
        protected facebookAuth: Facebook,
        protected authGoogle: GoogleAuth,
        protected authFacebook: FacebookAuth,
    ) {}

    /**
     * Get user from cache if possible
     */
    @Cacheable()
    public getUser(): Observable<User | unknown | null> {
        console.log("Get user NOT from cache.");
        return this.fetchUser();
    }

    public async signInViaGoogle(): Promise<any> {
        return await this.authGoogle.handleLogin().then((credential: any) => {
            this.updateDbDataByFirebaseUser(credential.user);
            this.onAfterLogin();
        });
    }

    public async signInViaFacebook(): Promise<any> {
        return await this.authFacebook.handleLogin().then((credential: any) => {
            this.updateDbDataByFirebaseUser(credential.user);
            this.onAfterLogin();
        });
    }

    public async updateDbDataByUser(user: User): Promise<void> {
        if (user.uid) {
            const userRef = this.getUserRef(user.uid);

            const data = new FirebaseUserModel({
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                uid: user.uid,
            });

            return userRef.set(Object.assign({}, data), { merge: true });
        } else {
            return;
        }
    }

    public async signOut(): Promise<void> {
        await this.angularFireAuth.auth.signOut();
        this.onAfterSignOut();
    }

    protected onAfterSignOut() {
        if (this.options.loginPage) {
            this.router.navigate([this.options.loginPage]);
        }
    }

    protected onAfterLogin() {
        if (this.options.afterLoginPage) {
            this.router.navigate([this.options.afterLoginPage]);
        }
    }

    protected fetchUser(): Observable<User | unknown | null> {
        // Get the auth state, then fetch the Firestore user document or return null
        return this.angularFireAuth.authState.pipe(
            switchMap((user: any) => {
                if (user) {
                    // User is logged in
                    return this.angularFirestore
                        .doc<FirebaseUserModel>(
                            `${this.options.firebaseUserTable}/${user.uid}`,
                        )
                        .valueChanges()
                        .pipe(
                            switchMap((userFirebase: any) => {
                                return new Observable(subscriber => {
                                    subscriber.next(
                                        Object.assign<User, any>(
                                            this.getNewUser() as User,
                                            userFirebase,
                                        ),
                                    );
                                    subscriber.complete();
                                });
                            }),
                        );
                }
                // Logged out
                return of(null);
            }),
        );
    }

    protected getNewUser() {
        return new UserModel();
    }

    protected getUserRef(
        userUid: string,
    ): AngularFirestoreDocument<FirebaseUserModel> {
        return this.angularFirestore
            .collection(this.options.firebaseUserTable)
            .doc(userUid);
    }

    protected updateDbDataByFirebaseUser(firebaseUser: FirebaseUserModel) {
        if (firebaseUser.uid) {
            const userRef = this.getUserRef(firebaseUser.uid);

            return userRef.set(Object.assign({}, firebaseUser), {
                merge: true,
            });
        } else {
            console.error("Firebase user has no UID.");
        }
    }
}
