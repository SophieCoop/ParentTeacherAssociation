package com.vaadhorim.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // מתחת לאנדרואיד 15 החלון אינו מקצה לקצה, ו-adjustResize כבר מקטין
        // אותו בגובה המקלדת. המאזין של SystemBars מוסיף ריפוד באותו גובה
        // להורה של ה-WebView, כך שהמקלדת נגרעה פעמיים: טופס בחלון קופץ
        // נדחק לרצועה צרה, והכפתורים שבתחתיתו יצאו מהמסך (נמצא בפטק).
        // בגרסאות האלה אין גם פסי מערכת שצריך להתרחק מהם, ולכן המאזין
        // מוחלף באחד שמשאיר את המקלדת לחלון. התוספים נטענים ב-super.onCreate,
        // ולכן זה רץ אחריו.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            View container = (View) getBridge().getWebView().getParent();
            ViewCompat.setOnApplyWindowInsetsListener(container, (v, insets) -> {
                v.setPadding(0, 0, 0, 0);
                return insets;
            });
        }
    }
}
